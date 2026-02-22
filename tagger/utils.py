import websockets
import json

async def ws_safe_send(websocket: websockets.ServerConnection, payload: dict):
    try:
        await websocket.send(json.dumps(payload))
    except websockets.exceptions.ConnectionClosed:
        raise
    except Exception as e:
        print(f"Failed to send ws message: {e}")
    
def ws_error_payload(message: str, details: str | None = None) -> dict:
    payload = { "error": message }
    
    if details:
        payload["details"] = details

    return payload
