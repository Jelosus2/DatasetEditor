from http.server import HTTPServer, BaseHTTPRequestHandler
from PIL import Image, ImageFile
from pathlib import Path
import onnxruntime as ort
import pandas as pd
import numpy as np
import huggingface_hub
import torch
import json
import sys

def tag_images(images: list[str], tagger_model: str, general_threshold: float, character_threshold: float, remove_underscores: bool, tags_ignored: list[str]) -> dict[str, list[str]]:
    final_dict = {}

    model, tag_data, target_size = load_model(tagger_model)
    total_images = len(images)
    tagged_images = 1

    print(f'Found {total_images} images')
    for image in images:
        image_path = Path(image)
        if not image_path.exists():
            print(f'{image} not found, skipping')
            continue

        print(f'({tagged_images}/{total_images}) Tagging {image}...')
        try:
            with Image.open(image) as img:
                processed_image = prepare_image(img, target_size)
                preds = model.run(None, { model.get_inputs()[0].name: processed_image })[0]

                processed_tags = process_predictions(preds, tag_data, general_threshold, character_threshold, remove_underscores, tags_ignored)
                
                normalized = Path(image).as_posix()
                final_dict[normalized] = processed_tags
        except Exception as e:
            print(f'Failed to tag {image}: {e}')
        
        tagged_images = tagged_images + 1

    print('Tagging finished')
    return final_dict

def download_model(model: str) -> tuple[str, str]:
    model_repo = f'SmilingWolf/{model}'
    print('Downloading model if necessary...')
    try:
        csv_path = huggingface_hub.hf_hub_download(model_repo, 'selected_tags.csv')
        model_path = huggingface_hub.hf_hub_download(model_repo, 'model.onnx')
    except Exception as e:
        print(f'Failed to download file from {model_repo}: {e}')
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
        print(f'Failed to load tags csv: {e}')
        raise
    tag_data = LabelData(
        names=csv_content['name'].tolist(),
        general=list(np.where(csv_content['category'] == 0)[0]),
        character=list(np.where(csv_content['category'] == 4)[0]),
    )
    providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    try:
        model = ort.InferenceSession(model_path, providers=providers)
        target_size = model.get_inputs()[0].shape[2]
    except Exception as e:
        print(f'Failed to initialise model: {e}', file=sys.stderr)
        raise

    return model, tag_data, target_size

def prepare_image(image: ImageFile.ImageFile, target_size: int) -> np.ndarray:
    canvas = Image.new('RGB', image.size, (255, 255, 255))
    canvas.paste(image, mask=image.split()[3] if image.mode == 'RGBA' else None)
    prepared_image = canvas.convert('RGB')

    max_dim = max(prepared_image.size)
    pad_left = (max_dim - prepared_image.size[0]) // 2
    pad_top = (max_dim - prepared_image.size[1]) // 2
    padded_image = Image.new('RGB', (max_dim, max_dim), (255, 255, 255))
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
        final_tags = [tag.replace('_', ' ') for tag in final_tags]

    if tags_ignored:
        ignored_set = set(tag.lower().strip() for tag in tags_ignored)
        final_tags = [tag for tag in final_tags if tag.lower() not in ignored_set]

    return final_tags

class ServerHandle(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def good_response(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b'Invalid request - this is a POST only internal server')

    def do_POST(self):
        if self.path == '/tagger':
            length = int(self.headers.get('content-length') or 0)
            data = json.loads(self.rfile.read(length))

            images: list[str] = data['images']
            tagger_model: str = data['model']
            character_threshold: float = float(data['character_threshold'])
            general_threshold: float = float(data['general_threshold'])
            remove_underscores: bool = data['remove_underscores']
            tags_ignored: list[str] = data.get('tags_ignored', [])

            try:
                tagged_images = tag_images(images, tagger_model, general_threshold, character_threshold, remove_underscores, tags_ignored)
            except Exception as e:
                print(f'Error during tagging: {e}')
                self.good_response({'error': str(e)})
                return

            self.good_response(tagged_images)
        elif self.path == '/device':
            self.good_response({ 'device': 'GPU' if torch.cuda.is_available() else 'CPU' })
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Invalid endpoint')

def run(port: int = 3067):
    try:
        server_address = ('', port)
        httpd = HTTPServer(server_address, ServerHandle)
        print(f'Service running on port {port}')
        httpd.serve_forever()
    except Exception as e:
        print(f'Error while trying to start the autotagger service: {e}')

if __name__ == '__main__':
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 3067
    run(port_arg)