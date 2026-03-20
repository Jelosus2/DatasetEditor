import asyncio
import json
import sys

try:
    from utils import ws_safe_send, ws_error_payload
    from model_manager import download_model, get_info_payload, delete_model, get_model_action_payload
    from tagger import tag_images
    import websockets
    import torch
except Exception as e:
    print(f"Dependencies are not installed, please install them before running the server. Error: {e}")
    sys.exit(1)

async def process_image_stream(websocket: websockets.ServerConnection, data):
    images: list[str] = data.get("images", [])
    tagger_models: list[dict] = data.get("models", [])
    tags_ignored: list[str] = data.get("tags_ignored", [])
    remove_underscores: bool = data.get("remove_underscores", True)
    disable_character_threshold: bool = data.get("disable_character_threshold", False)

    await tag_images(websocket, images, tagger_models, remove_underscores, disable_character_threshold, tags_ignored)

async def handle_model_download(model: str, model_file: str, tags_file: str, websocket: websockets.ServerConnection):
    try:
        await asyncio.to_thread(download_model, model, model_file, tags_file)
        payload = get_model_action_payload()
        await ws_safe_send(websocket, payload)
    except Exception as e:
        print(f"Failed to download model: {e}")
        await ws_safe_send(websocket, ws_error_payload("Failed to download model", str(e)))

async def handler(websocket: websockets.ServerConnection):
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError as e:
                await ws_safe_send(websocket, ws_error_payload("Invalid JSON", str(e)))
                continue

            command = data.get("command")
            if not command:
                await ws_safe_send(websocket, ws_error_payload("Missing 'command'"))
                continue
            
            try:
                if command == "tag":
                    await process_image_stream(websocket, data)
                elif command == "device":
                    device = "GPU" if torch.cuda.is_available() else "CPU"
                    await ws_safe_send(websocket, { "device": device })
                elif command == "download_model":
                    model = data.get("model")
                    model_file = data.get("model_file")
                    tags_file = data.get("tags_file")
                    asyncio.create_task(handle_model_download(model, model_file, tags_file, websocket))
                elif command == "models_status":
                    models = data.get("models")
                    payload = get_info_payload(models)
                    await ws_safe_send(websocket, payload)
                elif command == "delete_model":
                    model = data.get("model")
                    success = await asyncio.to_thread(delete_model, model)
                    payload = { "success": success } | get_model_action_payload()
                    await ws_safe_send(websocket, payload)
                else:
                    await ws_safe_send(websocket, ws_error_payload(f"Unknown command: {command}"))

            except websockets.exceptions.ConnectionClosed:
                raise
            except Exception as e:
                print(f"Command failed ({command})")
                await ws_safe_send(websocket, ws_error_payload("Command failed", str(e)))
            
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
