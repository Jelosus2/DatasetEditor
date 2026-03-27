from model_manager import download_model, is_model_downloaded, get_model_file_paths
from tagger import ModelInputSpec, unload_model
from utils import ws_safe_send
from pathlib import Path
from PIL import Image, ImageFile
from tqdm import tqdm
import onnxruntime as ort
import numpy as np
import websockets
import asyncio

MODEL_REPO = "DraconicDragon/Kaloscope-onnx"
MODEL_FILE = "v2.0/kaloscope_2-0.onnx"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

async def compare_style(websocket: websockets.ServerConnection,images: list[str]) -> dict:
    if len(images) < 3:
        raise ValueError("Need at least three images for style comparison")

    model, model_spec = load_model()
    vectors_dict: dict[str, np.ndarray] = {}

    try:
        with tqdm(desc="Comparing image styles", ascii=" ##########", bar_format="{desc} {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt}", colour="green", total=len(images)) as pbar:
            for image in images:
                image_path = Path(image)
                if not image_path.exists():
                    print(f"{image} not found, skipping")
                    pbar.update(1)
                    continue

                vector = get_image_style_vector(model, model_spec, image_path)
                if vector is not None:
                    vectors_dict[image_path.as_posix()] = vector

                pbar.update(1)

                await ws_safe_send(websocket, { "type": "progress" })
                await asyncio.sleep(0)

        if len(vectors_dict) < 3:
            raise ValueError("Could not generate embeddings for at least three images")
            
        image_names = list(vectors_dict.keys())
        matrix = np.vstack([vectors_dict[name] for name in image_names])
        sim_matrix = cosine_similarity_matrix(matrix)

        upper_tri_indices = np.triu_indices(len(image_names), k=1)
        folder_cohesion = float(np.mean(sim_matrix[upper_tri_indices]))

        centroid = np.mean(matrix, axis=0)
        centroid = normalize_vector(centroid)

        results: list[dict] = []
        for i, file in enumerate(image_names):
            fit_score = cosine_similarity_pair(matrix[i], centroid)
                
            all_sims = sim_matrix[i].copy()
            all_sims[i] = -1.0
            companion_score = float(all_sims.max())

            results.append({
                "file": file,
                "fit_score": fit_score,
                "companion_score": companion_score
            })

        results.sort(key=lambda item: item["fit_score"])

        print(f"Style comparison finished for {len(results)} images")
        response = {
            "folder_cohesion": folder_cohesion,
            "results": results
        }
        
        await ws_safe_send(websocket, response)
    finally:
        unload_model(model)

def ensure_model_downloaded() -> str:
    print(f"Checking style model {MODEL_REPO}...")

    if not is_model_downloaded(MODEL_REPO, MODEL_FILE):
        download_model(MODEL_REPO, MODEL_FILE)

    model_path, _ = get_model_file_paths(MODEL_REPO, MODEL_FILE)
    if model_path is None:
        raise RuntimeError(f"Could not find {MODEL_FILE} in cache for {MODEL_REPO}")

    return model_path

def load_model() -> tuple[ort.InferenceSession, ModelInputSpec]:
    model_path = ensure_model_downloaded()
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    model = ort.InferenceSession(model_path, providers=providers)
    input_meta = model.get_inputs()[0]
    output_meta = model.get_outputs()[0]

    model_spec = ModelInputSpec(input_name=input_meta.name, output_name=output_meta.name, target_size=448, layout="NCHW")

    print(f"Loaded style model with input {input_meta.shape} -> layout={model_spec.layout}, target_size=448, embedding_output={output_meta.name}")
    return model, model_spec

def preprocess_image(image: ImageFile.ImageFile, target_size: int) -> np.ndarray:
    image = image.convert("RGB")
    image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)

    image_np = np.asarray(image, dtype=np.float32) / 255.0
    image_np = (image_np - IMAGENET_MEAN) / IMAGENET_STD
    image_np = image_np.transpose((2, 0, 1))

    return np.expand_dims(image_np, axis=0).astype(np.float32)

def softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    x = x - np.max(x)
    exp_x = np.exp(x)
    return exp_x / np.sum(exp_x)

def normalize_vector(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector
    return vector / norm

def cosine_similarity_pair(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))

def cosine_similarity_matrix(matrix: np.ndarray) -> np.ndarray:
    return matrix @ matrix.T

def get_image_style_vector(model: ort.InferenceSession, model_spec: ModelInputSpec, image_path: Path) -> np.ndarray | None:
    try:
        with Image.open(image_path) as img:
            processed_image = preprocess_image(img, model_spec.target_size)
            logits = model.run([model_spec.output_name], { model_spec.input_name: processed_image })[0]
            logits = np.asarray(logits, dtype=np.float32).reshape(-1)
            probabilities = softmax(logits)
            vector = normalize_vector(probabilities)
            return vector
    except Exception as e:
        print(f"Failed to process {image_path.name}: {e}")
        return None
