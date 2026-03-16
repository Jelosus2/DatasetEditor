from huggingface_hub import hf_hub_download, scan_cache_dir, try_to_load_from_cache
from pathlib import Path
from tqdm import tqdm
import os

class HFProgress(tqdm):
    def __init__(self, *args, **kwargs):
        kwargs.pop("name", None)
        super().__init__(*args, **kwargs)

def download_model(model_repo: str, model_file: str, tags_file: str):
    print(f"Downloading {model_repo}...")

    hf_hub_download(model_repo, model_file, tqdm_class=HFProgress)
    hf_hub_download(model_repo, tags_file, tqdm_class=HFProgress)

    print (f"Downloaded {model_repo} successfully")

def is_model_downloaded(model_repo: str, model_file: str, tags_file: str) -> bool:
    model, tags = get_model_file_paths(model_repo, model_file, tags_file)
    return model != None and tags != None
    
def get_models_status(models: dict) -> dict[str, bool]:
    return { model: is_model_downloaded(model, properties.get("modelFile", ""), properties.get("tagsFile", "")) for model, properties in models.items() }

def get_cache_size_bytes() -> int:
    cache_info = scan_cache_dir()
    return cache_info.size_on_disk

def get_info_payload(models: dict) -> dict:
    cache_dir = os.environ.get("HF_HUB_CACHE", "")
    Path(cache_dir).mkdir(parents=True, exist_ok=True)

    return {
        "status": get_models_status(models),
        "cache_size_bytes": get_cache_size_bytes()
    }

def get_model_action_payload() -> dict:
    return {
        "cache_size_bytes": get_cache_size_bytes()
    }

def delete_model(model_repo: str):
    print(f"Deleting {model_repo}...\nDo no stop the process, the cache could get corrupted")

    cache_info = scan_cache_dir()
    repository = next((repo for repo in cache_info.repos if repo.repo_id == model_repo), None)
    if not repository:
        print("Model not found, skipped deletion")
        return False
    
    cache_info.delete_revisions(*[revision.commit_hash for revision in repository.revisions]).execute()
    print(f"Deleted {model_repo} successfully")
    return True

def get_model_file_paths(model_repo: str, model_filename: str, tags_filename: str):
    try:
        model_path = try_to_load_from_cache(model_repo, model_filename)
        csv_path = try_to_load_from_cache(model_repo, tags_filename)

        return model_path, csv_path
    except Exception:
        return None, None
