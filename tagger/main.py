from pathlib import Path
import asyncio
import json
import sys
import gc

try:
    from model_manager import download_model, get_info_payload, delete_model, get_model_action_payload
    from PIL import Image, ImageFile
    import onnxruntime as ort
    import pandas as pd
    import numpy as np
    import huggingface_hub
    import websockets
    import torch
except Exception as e:
    print(f"Dependencies are not installed, please install them before running the server. Error: {e}")
    sys.exit(1)

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

def download_model_legacy(model_repo: str) -> tuple[str, str]:
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
    csv_path, model_path = download_model_legacy(tagger_model)
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

async def handle_model_download(model: str, model_file: str, tags_file: str, websocket: websockets.ServerConnection):
    try:
        await asyncio.to_thread(download_model, model, model_file, tags_file)
        payload = get_model_action_payload()
        await safe_send(websocket, payload)
    except Exception as e:
        print(f"Failed to download model: {e}")
        await safe_send(websocket, error_payload("Failed to download model", str(e)))

async def safe_send(websocket: websockets.ServerConnection, payload: dict):
    try:
        await websocket.send(json.dumps(payload))
    except Exception as e:
        print(f"Failed to send ws message: {e}")

def error_payload(message: str, details: str | None = None) -> dict:
    payload = { "error": message }
    
    if details:
        payload["details"] = details

    return payload

async def handler(websocket: websockets.ServerConnection):
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError as e:
                await safe_send(websocket, error_payload("Invalid JSON", str(e)))
                continue

            command = data.get("command")
            if not command:
                await safe_send(websocket, error_payload("Missing 'command'"))
                continue
            
            try:
                if command == "tag":
                    await process_image_stream(websocket, data)
                elif command == "device":
                    device = "GPU" if torch.cuda.is_available() else "CPU"
                    await safe_send(websocket, { "device": device })
                elif command == "download_model":
                    model = data.get("model")
                    model_file = data.get("model_file")
                    tags_file = data.get("tags_file")
                    asyncio.create_task(handle_model_download(model, model_file, tags_file, websocket))
                elif command == "models_status":
                    models = data.get("models")
                    payload = get_info_payload(models)
                    await safe_send(websocket, payload)
                elif command == "delete_model":
                    model = data.get("model")
                    success = await asyncio.to_thread(delete_model, model)
                    payload = { "success": success } | get_model_action_payload()
                    await safe_send(websocket, payload)
                else:
                    await safe_send(websocket, error_payload(f"Unknown command: {command}"))
                
            except Exception as e:
                print(f"Command failed ({command})")
                await safe_send(websocket, error_payload("Command failed", str(e)))
            
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

async def main(port: int):
    async with websockets.serve(handler, "localhost", port, max_size=None):
        print(f"Tagger service running on port {port}")
        await asyncio.Future()

if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 3067

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(main(port_arg))
    except KeyboardInterrupt:
        pass
