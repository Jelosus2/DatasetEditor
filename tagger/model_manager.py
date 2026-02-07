from tqdm.auto import tqdm
from huggingface_hub import hf_hub_download, scan_cache_dir, try_to_load_from_cache

class HFProgress(tqdm):
    def __init__(self, *args, **kwargs):
        kwargs.pop("name", None)
        super().__init__(*args, **kwargs)

def download_model(model_repo: str):
    print(f"Downloading {model_repo}...")

    hf_hub_download(model_repo, "model.onnx", tqdm_class=HFProgress)
    hf_hub_download(model_repo, "selected_tags.csv", tqdm_class=HFProgress)

    print (f"Downloaded {model_repo} successfully")

def is_model_downloaded(model_repo: str) -> bool:
    try:
        model = try_to_load_from_cache(model_repo, "model.onnx")
        tags = try_to_load_from_cache(model_repo, "selected_tags.csv")

        return model != None and tags != None
    except Exception:
        return False
    
def get_models_status(models: list[str]) -> dict[str, bool]:
    return { model: is_model_downloaded(model) for model in models }

def get_cache_size_bytes() -> int:
    cache_info = scan_cache_dir()
    return cache_info.size_on_disk

def get_info_payload(models: list[str]) -> dict:
    return {
        "status": get_models_status(models),
        "cache_size_bytes": get_cache_size_bytes()
    }

def get_model_action_payload() -> dict:
    return {
        "cache_size_bytes": get_cache_size_bytes()
    }

def delete_model(model_repo: str) -> bool:
    print(f"Deleting {model_repo}... Do no stop the process, the cache could get corrupted")

    cache_info = scan_cache_dir()
    repository = next((repo for repo in cache_info.repos if repo.repo_id == model_repo), None)
    if not repository:
        print("Model not found, skipped deletion")
        return
    
    cache_info.delete_revisions(*[revision.commit_hash for revision in repository.revisions]).execute()
    print(f"Deleted {model_repo} successfully")