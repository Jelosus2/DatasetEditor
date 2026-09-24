from model_manager import is_model_downloaded, get_model_file_paths, get_timm_model_directory
from utils import ws_safe_send, ws_error_payload
from typing import Callable
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import onnxruntime as ort
import pandas as pd
import numpy as np
import websockets
import asyncio
import torch
import json
import gc

class LabelData:
    def __init__(
        self,
        names: list[str],
        general: list[int],
        character: list[int],
        tag_thresholds: list[float | None] | None = None,
        category_thresholds: dict[int, float] | None = None
    ):
        self.names = names
        self.general = general
        self.character = character
        self.tag_thresholds = tag_thresholds
        self.category_thresholds = category_thresholds or {}


class ModelInputSpec:
    def __init__(self, input_name: str, target_size: int, layout: str, output_name: str):
        self.input_name = input_name
        self.target_size = target_size
        self.layout = layout
        self.output_name = output_name

async def tag_images(
    websocket: websockets.ServerConnection,
    images: list[str],
    tagger_models: list[dict],
    remove_underscores: bool,
    disable_character_threshold: bool,
    tags_ignored: list[str]
):
    for tagger_model in tagger_models:
        model_repo = tagger_model.get("repo_id", "")
        model_file = tagger_model.get("model_file", "")
        model_tags_file = tagger_model.get("tags_file", "")
        extra_files = tagger_model.get("extra_files", [])
        backend = tagger_model.get("backend", "onnx")
        general_threshold = float(tagger_model.get("general_threshold", 0.25))
        character_threshold = float(tagger_model.get("character_threshold", 0.35))
        threshold_source = tagger_model.get("threshold_source", "manual")

        if threshold_source == "thresholds_file" and (backend != "timm" or "thresholds.csv" not in extra_files):
            raise ValueError(f"{model_repo}: select and download thresholds.csv before using it")

        if not is_model_downloaded(model_repo, model_file, model_tags_file, extra_files, backend):
            print(f"{model_repo} not found in the cache repository, model skipped")
            continue

        print(f"Loading {model_repo} ({backend})...")
        predict, tag_data, uses_cuda = load_predictor(model_repo, model_file, model_tags_file, backend, extra_files, threshold_source)

        try:
            with tqdm(desc=f"Autotagging images with {model_repo}...", ascii=" ##########", bar_format="{desc} {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt}", colour="green", total=len(images)) as pbar:
                for image in images:
                    image_path = Path(image)
                    if not image_path.exists():
                        print(f"{image} not found, skipping")
                        pbar.update(1)
                        continue
            
                    try:
                        with Image.open(image_path) as img:
                            probabilities = predict(img)
                            processed_tags = process_probabilities(
                                probabilities,
                                tag_data,
                                general_threshold,
                                character_threshold,
                                remove_underscores,
                                tags_ignored,
                                disable_character_threshold
                            )
            
                        await ws_safe_send(websocket, {
                            "type": "result",
                            "file": image_path.as_posix(),
                            "tags": processed_tags
                        })
                                    
                        await asyncio.sleep(0)
                        pbar.update(1)
            
                    except websockets.exceptions.ConnectionClosed:
                        pbar.write("Client disconnected, stopping tagging")
                        return
                                
                    except Exception as e:
                        print(f"Failed to tag {image}: {e}")
                        pbar.update(1)
                        await ws_safe_send(websocket, { "type": "error" } | ws_error_payload(f"Error tagging {image}", str(e)))

        finally:
            del predict
            gc.collect()
            if uses_cuda:
                torch.cuda.empty_cache()

    try:
        print("Tagging finished")
        await ws_safe_send(websocket, { "type": "done" })
    except websockets.exceptions.ConnectionClosed:
        pass

def read_optional_thresholds(values: pd.Series, source: str) -> list[float | None]:
    thresholds: list[float | None] = []

    for raw in values:
        if pd.isna(raw) or not str(raw).strip():
            thresholds.append(None)
            continue

        try:
            threshold = float(raw)
        except (TypeError, ValueError) as error:
            raise ValueError(f"{source} contains an invalid threshold: {raw!r}") from error

        if not np.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError(f"{source} contains a threshold outside [0, 1]: {raw!r}")

        thresholds.append(threshold)

    return thresholds

def load_tag_data(csv_path: str | Path, threshold_source: str = "manual", thresholds_path: str | Path | None = None) -> LabelData:
    if threshold_source not in {"manual", "tags_file", "thresholds_file"}:
        raise ValueError(f"Unsupported threshold source: {threshold_source}")

    columns = ["name", "category"]
    if threshold_source == "tags_file":
        columns.append("best_threshold")

    try:
        csv_content = pd.read_csv(csv_path, usecols=columns)
    except ValueError as error:
        if threshold_source == "tags_file":
            raise ValueError(f"{csv_path} needs a best_threshold column") from error
        raise

    tag_thresholds = None
    if threshold_source == "tags_file":
        tag_thresholds = read_optional_thresholds(csv_content["best_threshold"], str(csv_path))

    category_thresholds: dict[int, float] = {}

    if threshold_source == "thresholds_file":
        if thresholds_path is None:
            raise ValueError("thresholds.csv is required for this threshold source")

        try:
            category_data = pd.read_csv(thresholds_path, usecols=["category", "threshold"])
        except ValueError as error:
            raise ValueError(f"{thresholds_path} needs category and threshold columns") from error

        categories = pd.to_numeric(category_data["category"], errors="raise")
        thresholds = read_optional_thresholds(category_data["threshold"], str(thresholds_path))
        seen_categories: set[int] = set()

        for category, threshold in zip(categories, thresholds):
            if pd.isna(category) or not float(category).is_integer():
                raise ValueError(f"Invalid category in {thresholds_path}: {category}")

            category = int(category)
            if category in seen_categories:
                raise ValueError(f"Duplicate category {category} in {thresholds_path}")
            
            seen_categories.add(category)

            if category in (0, 4) and threshold is not None:
                category_thresholds[category] = threshold

    return LabelData(
        names=[str(name) for name in csv_content["name"].fillna("").tolist()],
        general=list(np.where(csv_content["category"] == 0)[0]),
        character=list(np.where(csv_content["category"] == 4)[0]),
        tag_thresholds=tag_thresholds,
        category_thresholds=category_thresholds
    )

def prepare_timm_image(image: Image.Image, transform: object) -> torch.Tensor:
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA") if "transparency" in image.info else image.convert("RGB")

    if image.mode == "RGBA":
        white = Image.new("RGBA", image.size, (255, 255, 255, 255))
        white.alpha_composite(image)
        image = white.convert("RGB")

    side = max(image.size)
    padded = Image.new("RGB", (side, side), (255, 255, 255))
    padded.paste(image, ((side - image.width) // 2, (side - image.height) // 2))

    if not callable(transform):
        raise TypeError("Expected a single callable timm transform")

    transformed = transform(padded)
    if not isinstance(transformed, torch.Tensor):
        raise TypeError(f"Expected a PyTorch tensor from timm transform, got {type(transformed).__name__}")

    return transformed.unsqueeze(0)[:, [2, 1, 0]]

def json_transform_size(value: object) -> int | tuple[int, int]:
    if type(value) is int and value > 0:
        return value

    if isinstance(value, list) and len(value) == 2 and all(type(item) is int and item > 0 for item in value):
        return value[0], value[1]

    raise ValueError(f"Unsupported preprocess size: {value!r}")

def load_json_timm_transform(config_path: Path) -> Callable[[Image.Image], torch.Tensor]:
    from torchvision import transforms as T

    with config_path.open("r", encoding="utf-8") as file:
        config = json.load(file)

    steps = config.get("test") if isinstance(config, dict) else None
    expected = [
        "pad_to_size",
        "resize",
        "center_crop",
        "maybe_to_tensor",
        "normalize"
    ]

    if (
        not isinstance(steps, list)
        or len(steps) != len(expected)
        or not all(isinstance(step, dict) for step in steps)
        or [step.get("type") for step in steps] != expected
    ):
        raise ValueError(f"Unsupported test preprocessing pipeline in {config_path}")

    pad_step, resize_step, crop_step, _, normalize_step = steps

    if pad_step.get("background_color") != "white":
        raise ValueError("Only white pad_to_size backgrounds are supported")

    pad_size = json_transform_size(pad_step.get("size"))
    if isinstance(pad_size, int):
        pad_width = pad_height = pad_size
    else:
        pad_width, pad_height = pad_size

    pil_interpolations = {
        "bilinear": Image.Resampling.BILINEAR,
        "bicubic": Image.Resampling.BICUBIC
    }
    tv_interpolations = {
        "bilinear": T.InterpolationMode.BILINEAR,
        "bicubic": T.InterpolationMode.BICUBIC
    }

    pad_interpolation = pil_interpolations.get(pad_step.get("interpolation"))
    resize_interpolation = tv_interpolations.get(resize_step.get("interpolation"))

    if pad_interpolation is None or resize_interpolation is None:
        raise ValueError("Unsupported preprocessing interpolation")

    if resize_step.get("max_size") is not None:
        raise ValueError("preprocess.json resize max_size is not supported")

    antialias = resize_step.get("antialias", True)
    if not isinstance(antialias, bool):
        raise ValueError("Invalid preprocess antialias value")

    resize_size = json_transform_size(resize_step.get("size"))
    crop_size = json_transform_size(crop_step.get("size"))

    mean = normalize_step.get("mean")
    std = normalize_step.get("std")
    if (
        not isinstance(mean, list)
        or not isinstance(std, list)
        or len(mean) != 3
        or len(std) != 3
        or not all(isinstance(v, (int, float)) for v in [*mean, *std])
        or any(v == 0 for v in std)
    ):
        raise ValueError("Invalid preprocess normalization values")

    def pad_to_size(image: Image.Image) -> Image.Image:
        ratio = min(pad_width / image.width, pad_height / image.height)
        new_width = max(1, round(image.width * ratio))
        new_height = max(1, round(image.height * ratio))

        resized = image.resize((new_width, new_height), pad_interpolation)
        canvas = Image.new("RGB", (pad_width, pad_height), "white")
        canvas.paste(resized, ((pad_width - new_width) // 2, (pad_height - new_height) // 2))
        return canvas

    pipeline = T.Compose([
        pad_to_size,
        T.Resize(resize_size, interpolation=resize_interpolation, antialias=antialias),
        T.CenterCrop(crop_size),
        T.ToTensor(),
        T.Normalize(mean=mean, std=std)
    ])

    def transform(image: Image.Image) -> torch.Tensor:
        result = pipeline(image)
        if not isinstance(result, torch.Tensor):
            raise TypeError("preprocess.json did not produce a tensor")
        return result

    return transform

def prepare_json_timm_image(image: Image.Image, transform: object) -> torch.Tensor:
    if not callable(transform):
        raise TypeError("Expected a callable preprocess.json transform")

    background = Image.new("RGBA", image.size, "white")
    background.alpha_composite(image.convert("RGBA"))
    transformed = transform(background.convert("RGB"))

    if not isinstance(transformed, torch.Tensor) or transformed.ndim != 3 or transformed.shape[0] != 3:
        raise ValueError("preprocess.json must produce a 3-channel tensor")

    return transformed.unsqueeze(0)

def load_predictor(
    model_repo: str,
    model_file: str,
    tags_file: str,
    backend: str,
    extra_files: list[str] | None = None,
    threshold_source: str = "manual"
) -> tuple[Callable[[Image.Image], np.ndarray], LabelData, bool]:
    if backend == "onnx":
        session, tag_data, input_spec = load_model(model_repo, model_file, tags_file, threshold_source)

        def predict_onnx(image: Image.Image) -> np.ndarray:
            processed = prepare_image(image, input_spec)
            output = session.run([input_spec.output_name], {input_spec.input_name: processed})[0]

            if not isinstance(output, np.ndarray):
                raise TypeError(f"Unexpected ONNX output type for {model_repo}: {type(output).__name__}")

            return to_probabilities(output)

        return predict_onnx, tag_data, False

    if backend != "timm":
        raise ValueError(f"Unsupported model backend: {backend}")

    selected_extra_files = extra_files or []
    model_dir = get_timm_model_directory(model_repo, model_file, tags_file, selected_extra_files)

    if model_dir is None:
        raise RuntimeError(f"Missing timm model files for {model_repo}")

    import timm
    from timm.data.transforms_factory import create_transform
    from timm.data.config import resolve_data_config

    model = timm.create_model(f"local-dir:{model_dir}", pretrained=False, checkpoint_path=str(Path(model_dir) / model_file)).eval()
    tag_data = load_tag_data(
        Path(model_dir) / tags_file,
        threshold_source,
        Path(model_dir) / "thresholds.csv" if threshold_source == "thresholds_file" else None
    )

    num_classes = getattr(model, "num_classes", None)
    if isinstance(num_classes, int) and num_classes != len(tag_data.names):
        raise ValueError(f"{model_repo} has {num_classes} outputs but {len(tag_data.names)} CSV rows")

    uses_json_transform = "preprocess.json" in selected_extra_files

    if uses_json_transform:
        transform = load_json_timm_transform(Path(model_dir) / "preprocess.json")
    else:
        pretrained_cfg = getattr(model, "pretrained_cfg", None)
        if not isinstance(pretrained_cfg, dict):
            raise ValueError(f"{model_repo} has no timm preprocessing config")

        transform = create_transform(**resolve_data_config(pretrained_cfg=pretrained_cfg, model=model))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    def predict_timm(image: Image.Image) -> np.ndarray:
        inputs = (prepare_json_timm_image(image, transform) if uses_json_transform else prepare_timm_image(image, transform)).to(device)

        with torch.inference_mode():
            logits = model(inputs)

            if not isinstance(logits, torch.Tensor) or logits.ndim != 2 or logits.shape != (1, len(tag_data.names)):
                raise ValueError(f"Unexpected output shape from {model_repo}: {getattr(logits, 'shape', type(logits))}")

            return logits.sigmoid()[0].float().cpu().numpy()

    return predict_timm, tag_data, device.type == "cuda"

def load_model(model_repo: str, model_filename: str, tags_filename: str, threshold_source: str = "manual") -> tuple[ort.InferenceSession, LabelData, ModelInputSpec]:
    model_path, csv_path = get_model_file_paths(model_repo, model_filename, tags_filename)
    if model_path is None or csv_path is None:
        print(f"There are files missing for the {model_repo} model, delete it and redownload")
        raise RuntimeError(f"Missing model files for {model_repo}")

    tag_data = load_tag_data(csv_path, threshold_source)
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    try:
        model = ort.InferenceSession(model_path, providers=providers)
        input_meta = model.get_inputs()[0]
        input_shape = input_meta.shape

        if len(input_shape) != 4:
            raise ValueError(f"Unsupported input rank for {model_repo}: {input_shape}")
        
        def as_int(value):
            return value if isinstance(value, int) else None
        
        dim1 = as_int(input_shape[1])
        dim2 = as_int(input_shape[2])
        dim3 = as_int(input_shape[3])

        if dim1 in (1, 3, 4):
            layout = "NCHW"
            target_size = dim2 or dim3 or 448
        elif dim3 in (1, 3, 4):
            layout = "NHWC"
            target_size = dim1 or dim2 or 448
        else:
            layout = "NHWC"
            target_size = dim2 or dim1 or 448

        expected_tags = len(tag_data.names)
        matched_output = None

        for output_meta in model.get_outputs():
            output_shape = output_meta.shape
            output_name = output_meta.name
            output_size = None

            for dim in reversed(output_shape):
                if isinstance(dim, int):
                    output_size = dim
                    break

            if output_size == expected_tags and not "logits" in output_name:
                matched_output = output_meta
                break

        if matched_output is None:
            available = [(output.name, output.shape) for output in model.get_outputs()]
            raise ValueError(f"No model output matches tags csv rows ({expected_tags}) for {model_repo}. Available outputs: {available}")
        
        input_spec = ModelInputSpec(input_name=input_meta.name, target_size=target_size, layout=layout, output_name=matched_output.name)

        print(f"Loaded {model_repo} with input shape {input_shape} -> layout={layout}, target_size={target_size}, output={matched_output.name}")
    except Exception as e:
        print(f"Failed to initialise model: {e}")
        raise

    return model, tag_data, input_spec

def prepare_image(image: Image.Image, input_spec: ModelInputSpec) -> np.ndarray:
    canvas = Image.new("RGB", image.size, (255, 255, 255))
    canvas.paste(image, mask=image.split()[3] if image.mode == "RGBA" else None)
    prepared_image = canvas.convert("RGB")

    max_dim = max(prepared_image.size)
    pad_left = (max_dim - prepared_image.size[0]) // 2
    pad_top = (max_dim - prepared_image.size[1]) // 2

    padded_image = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
    padded_image.paste(prepared_image, (pad_left, pad_top))
    padded_image = padded_image.resize((input_spec.target_size, input_spec.target_size), Image.Resampling.LANCZOS)

    image_array = np.asarray(padded_image, dtype=np.float32)
    image_array = image_array[..., [2, 1, 0]]

    if input_spec.layout == "NCHW":
        image_array = np.transpose(image_array, (2, 0, 1))

    return np.expand_dims(image_array, axis=0)

def process_probabilities(probabilities: np.ndarray, tag_data: LabelData, general_threshold: float, character_threshold: float, remove_underscores: bool, tags_ignored: list[str], disable_character_threshold: bool) -> list[str]:
    scores = probabilities.flatten().astype(np.float32)
    max_index = len(scores) - 1

    valid_general = [i for i in tag_data.general if 0 <= i <= max_index]
    valid_character = [i for i in tag_data.character if 0 <= i <= max_index]

    def effective_threshold(index: int, category: int, manual: float) -> float:
        if tag_data.tag_thresholds is not None:
            threshold = tag_data.tag_thresholds[index]
            return manual if threshold is None else threshold

        return tag_data.category_thresholds.get(category, manual)

    character_tags = (
        [
            tag_data.names[i] for i in valid_character
            if scores[i] >= effective_threshold(i, 4, character_threshold)
        ]
        if not disable_character_threshold else []
    )

    general_tags = [
        tag_data.names[i] for i in valid_general
        if scores[i] >= effective_threshold(i, 0, general_threshold)
    ]

    final_tags = general_tags + character_tags
    final_tags = [str(tag).strip() for tag in final_tags if str(tag).strip()]

    if remove_underscores:
        final_tags = [tag.replace("_", " ") for tag in final_tags]

    if tags_ignored:
        ignored_set = set(tag.lower().strip() for tag in tags_ignored)
        final_tags = [tag for tag in final_tags if tag.lower() not in ignored_set]

    return final_tags

def to_probabilities(preds: np.ndarray) -> np.ndarray:
    scores = preds.flatten().astype(np.float32)

    if np.all(scores >= 0.0) and np.all(scores <= 1.0):
        return scores
    
    return 1.0 / (1.0 + np.exp(-scores))

def unload_model(model: ort.InferenceSession):
    if model:
        del model
        gc.collect()
