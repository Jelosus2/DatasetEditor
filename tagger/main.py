from PIL import Image, ImageFile
from pathlib import Path
import onnxruntime as ort
import pandas as pd
import numpy as np
import huggingface_hub
import websockets
import asyncio
import torch
import json
import sys
import gc

async def tag_images(websocket: websockets.ServerConnection, images: list[str], tagger_models: list[str], general_threshold: float, character_threshold: float, remove_underscores: bool, tags_ignored: list[str]):
    for tagger_model in tagger_models:
        print(f"Loading {tagger_model} model...")
        model, tag_data, target_size = load_model(tagger_model)

        total_images = len(images)

        print(f"Found {total_images} images")
        for index, image in enumerate(images):
            image_path = Path(image)
            if not image_path.exists():
                print(f"{image} not found, skipping")
                continue

            print(f"({index + 1}/{total_images}) Tagging {image_path.stem}...")
            try:
                with Image.open(image_path) as img:
                    processed_image = prepare_image(img, target_size)
                    preds = model.run(None, { model.get_inputs()[0].name: processed_image })[0]

                    processed_tags = process_predictions(preds, tag_data, general_threshold, character_threshold, remove_underscores, tags_ignored)
                    
                    response = {
                        "type": "result",
                        "file": image_path.as_posix(),
                        "tags": processed_tags
                    }

                    await websocket.send(json.dumps(response))
                    await asyncio.sleep(0)
            except Exception as e:
                print(f"Failed to tag {image}: {e}")
                await websocket.send(json.dumps({ "type": "error", "error": f"Error tagging {image}: {e}" }))

        unload_model(model)

    print("Tagging finished")
    await websocket.send(json.dumps({ "type": "done" }))

def download_model(model: str) -> tuple[str, str]:
    model_repo = f"SmilingWolf/{model}"
    print("Downloading model if necessary...")
    try:
        csv_path = huggingface_hub.hf_hub_download(model_repo, "selected_tags.csv")
        model_path = huggingface_hub.hf_hub_download(model_repo, "model.onnx")
    except Exception as e:
        print(f"Failed to download file from {model_repo}: {e}")
    return csv_path, model_path

class LabelData:
    def __init__(self, names: list[str], general: list[int], character: list[int]):
        self.names: list[str] = names
        self.general: list[int] = general
        self.character: list[int] = character

def load_model(tagger_model: str) -> tuple[ort.InferenceSession, LabelData, int]:
    csv_path, model_path = download_model(tagger_model)
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
        print(f"Failed to initialise model: {e}", file=sys.stderr)
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

def process_predictions(preds: np.ndarray, tag_data: LabelData, general_threshold: float, character_threshold: float, remove_underscores: bool, tags_ignored: list[str]) -> list[str]:
    scores = preds.flatten()

    character_tags = [tag_data.names[i] for i in tag_data.character if scores[i] >= character_threshold]
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

async def process_image_stream(websocket: websockets.ServerConnection, data):
    images: list[str] = data.get("images", [])
    tagger_models: list[str] = data.get("models", [])
    character_threshold: float = float(data.get("character_threshold", 0.35))
    general_threshold: float = float(data.get("general_threshold", 0.25))
    remove_underscores: bool = data.get("remove_underscores", True)
    tags_ignored: list[str] = data.get("tags_ignored", [])

    await tag_images(websocket, images, tagger_models, general_threshold, character_threshold, remove_underscores, tags_ignored)

async def handler(websocket: websockets.ServerConnection):
    print("Client connected")
    try:
        async for message in websocket:
            data = json.loads(message)
            command = data.get("command")

            if command == "tag":
                await process_image_stream(websocket, data)
            elif command == "device":
                device = "GPU" if torch.cuda.is_available() else "CPU"
                await websocket.send(json.dumps({ "type": "info", "device": device }))
            
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

async def main(port: int):
    print(f"Tagger service running on port {port}")
    async with websockets.serve(handler, "localhost", port, max_size=None):
        await asyncio.Future()

if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 3067

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(main(port_arg))
    except KeyboardInterrupt:
        pass