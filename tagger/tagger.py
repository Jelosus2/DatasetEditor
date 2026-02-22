from model_manager import is_model_downloaded, get_model_file_paths
from utils import ws_safe_send, ws_error_payload
from PIL import Image, ImageFile
from pathlib import Path
from tqdm import tqdm
import onnxruntime as ort
import pandas as pd
import numpy as np
import websockets
import asyncio
import torch
import gc

class LabelData:
    def __init__(self, names: list[str], general: list[int], character: list[int]):
        self.names: list[str] = names
        self.general: list[int] = general
        self.character: list[int] = character

async def tag_images(websocket: websockets.ServerConnection, images: list[str], tagger_models: list[dict], remove_underscores: bool, disable_character_threshold: bool, tags_ignored: list[str]):
    for tagger_model in tagger_models:
        model_repo = tagger_model.get("repo_id", "")
        model_file = tagger_model.get("model_file", "")
        model_tags_file = tagger_model.get("tags_file", "")
        general_threshold = float(tagger_model.get("general_threshold", 0.25))
        character_threshold = float(tagger_model.get("character_threshold", 0.35))

        if not is_model_downloaded(model_repo, model_file, model_tags_file):
            print(f"{model_repo} not found in the cache repository, model skipped")
            continue

        print(f"Loading {model_repo} model...")
        model, tag_data, target_size = load_model(model_repo, model_file, model_tags_file)

        with tqdm(desc=f"Autotagging images with {model_repo}...", ascii=" ##########", bar_format="{desc} {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt}", colour="green", total=len(images)) as pbar:
            for image in images:
                image_path = Path(image)
                if not image_path.exists():
                    print(f"{image} not found, skipping")
                    pbar.update(1)
                    continue

                try:
                    with Image.open(image_path) as img:
                        processed_image = prepare_image(img, target_size)
                        preds = model.run(None, { model.get_inputs()[0].name: processed_image })[0]

                        processed_tags = process_predictions(preds, tag_data, general_threshold, character_threshold, remove_underscores, tags_ignored, disable_character_threshold)
                        
                        response = {
                            "type": "result",
                            "file": image_path.as_posix(),
                            "tags": processed_tags
                        }

                        await ws_safe_send(websocket, response)
                        await asyncio.sleep(0)
                        pbar.update(1)
                except websockets.exceptions.ConnectionClosed:
                    pbar.write("Client disconnected, stopping tagging")
                    unload_model(model)
                    return
                except Exception as e:
                    print(f"Failed to tag {image}: {e}")
                    pbar.update(1)
                    await ws_safe_send(websocket, { "type": "error" } | ws_error_payload(f"Error tagging {image}", str(e)))

        unload_model(model)

    try:
        print("Tagging finished")
        await ws_safe_send(websocket, { "type": "done" })
    except websockets.exceptions.ConnectionClosed:
        pass

def load_model(model_repo: str, model_filename: str, tags_filename: str) -> tuple[ort.InferenceSession, LabelData, int]:
    model_path, csv_path = get_model_file_paths(model_repo, model_filename, tags_filename)
    if model_path == None or csv_path == None:
        print(f"There are files missing for the {model_repo} model, delete it and redownload")
        raise

    try:
        csv_content = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Failed to load tags csv: {e}")
        raise

    tag_data = LabelData(
        names=csv_content["name"].tolist(),
        general=list(np.where(csv_content["category"] == 0)[0]),
        character=list(np.where(csv_content["category"] == 4)[0]),
    )
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    try:
        model = ort.InferenceSession(model_path, providers=providers)
        target_size = model.get_inputs()[0].shape[2]
    except Exception as e:
        print(f"Failed to initialise model: {e}")
        raise

    return model, tag_data, target_size

def prepare_image(image: ImageFile.ImageFile, target_size: int) -> np.ndarray:
    canvas = Image.new("RGB", image.size, (255, 255, 255))
    canvas.paste(image, mask=image.split()[3] if image.mode == "RGBA" else None)
    prepared_image = canvas.convert("RGB")

    max_dim = max(prepared_image.size)
    pad_left = (max_dim - prepared_image.size[0]) // 2
    pad_top = (max_dim - prepared_image.size[1]) // 2
    padded_image = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
    padded_image.paste(prepared_image, (pad_left, pad_top))
    padded_image = padded_image.resize((target_size, target_size), Image.Resampling.LANCZOS)

    image_array = np.asarray(padded_image, dtype=np.float32)[..., [2, 1, 0]]

    return np.expand_dims(image_array, axis=0)

def process_predictions(preds: np.ndarray, tag_data: LabelData, general_threshold: float, character_threshold: float, remove_underscores: bool, tags_ignored: list[str], disable_character_threshold: bool) -> list[str]:
    scores = preds.flatten()

    character_tags = [tag_data.names[i] for i in tag_data.character if scores[i] >= character_threshold] if not disable_character_threshold else []
    general_tags = [tag_data.names[i] for i in tag_data.general if scores[i] >= general_threshold]

    final_tags = general_tags + character_tags
    if remove_underscores:
        final_tags = [tag.replace("_", " ") for tag in final_tags]

    if tags_ignored:
        ignored_set = set(tag.lower().strip() for tag in tags_ignored)
        final_tags = [tag for tag in final_tags if tag.lower() not in ignored_set]

    return final_tags

def unload_model(model: ort.InferenceSession):
    if model:
        del model
        gc.collect()
