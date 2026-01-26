from __future__ import annotations
from tqdm.auto import tqdm
from huggingface_hub import hf_hub_download

class HFProgress(tqdm):
    def __init__(self, *args, **kwargs):
        kwargs.pop("name", None)
        super().__init__(*args, **kwargs)

def download_model(model_repo: str, cache_dir: str):
    print(f"Downloading {model_repo} to {cache_dir}...")

    hf_hub_download(model_repo, "model.onnx", cache_dir=cache_dir, tqdm_class=HFProgress)
    hf_hub_download(model_repo, "selected_tags.csv", cache_dir=cache_dir, tqdm_class=HFProgress)

    print (f"Downloaded {model_repo} successfully")