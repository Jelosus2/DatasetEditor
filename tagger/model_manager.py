from huggingface_hub import hf_hub_download, scan_cache_dir, try_to_load_from_cache, snapshot_download
from pathlib import Path
from tqdm.auto import tqdm
import os

TIMM_EXTRA_FILES = {"preprocess.json", "thresholds.csv"}

class HFProgress(tqdm):
    def __init__(self, *args, **kwargs):
        kwargs.pop("name", None)
        super().__init__(*args, **kwargs)

def download_model(model_repo: str, model_file: str, tags_file: str | None = None, extra_files: list[str] | None = None, backend: str = "onnx"):
    print(f"Downloading {model_repo} ({backend})...")

    if backend == "timm":
        files = required_timm_files(model_file, tags_file, extra_files)
        snapshot_path = Path(snapshot_download(repo_id=model_repo, allow_patterns=files, tqdm_class=HFProgress))

        missing = [
            filename for filename in files
            if not (snapshot_path / filename).is_file()
        ]

        if missing:
            raise FileNotFoundError(f"{model_repo} is missing required timm files: {missing}")

    elif backend == "onnx":
        hf_hub_download(model_repo, model_file, tqdm_class=HFProgress)
        if tags_file is not None:
            hf_hub_download(model_repo, tags_file, tqdm_class=HFProgress)

    else:
        raise ValueError(f"Unsupported model backend: {backend}")

    print (f"Downloaded {model_repo} successfully")


def required_timm_files(model_file: str, tags_file: str | None, extra_files: list[str] | None = None) -> list[str]:
    if not isinstance(model_file, str) or not model_file.lower().endswith(".safetensors"):
        raise ValueError("A timm model file must end in .safetensors")
    if not isinstance(tags_file, str) or not tags_file.lower().endswith(".csv"):
        raise ValueError("A timm tags file must end in .csv")

    names = [model_file, tags_file]
    for name in names:
        if not name or "/" in name or "\\" in name or ":" in name or any(char in name for char in "*?[]") or name in {".", ".."}:
            raise ValueError(f"Invalid model filename: {name!r}")

    extras = [] if extra_files is None else extra_files
    if not isinstance(extras, list) or any(not isinstance(file, str) or file not in TIMM_EXTRA_FILES for file in extras):
        raise ValueError("Unsupported timm extra file")

    return list(dict.fromkeys(["config.json", model_file, tags_file, *extras]))

def get_timm_model_directory(model_repo: str, model_file: str, tags_file: str | None, extra_files: list[str] | None = None) -> str | None:
    try:
        files = required_timm_files(model_file, tags_file, extra_files)
        directories: set[Path] = set()

        for filename in files:
            cached_path = try_to_load_from_cache(model_repo, filename)
            if not isinstance(cached_path, str):
                return None

            path = Path(cached_path)
            if not path.is_file():
                return None

            directories.add(path.parent)

        if len(directories) != 1:
            return None

        return str(next(iter(directories)))
    except (ValueError, OSError):
        return None

def is_model_downloaded(model_repo: str, model_file: str, tags_file: str | None = None, extra_files: list[str] | None = None, backend: str = "onnx") -> bool:
    if backend == "timm":
        return get_timm_model_directory(model_repo, model_file, tags_file, extra_files) is not None

    if backend != "onnx":
        raise ValueError(f"Unsupported model backend: {backend}")
    
    model, tags = get_model_file_paths(model_repo, model_file, tags_file)
    return model is not None and (tags_file is None or tags is not None)
    
def get_models_status(models: dict) -> dict[str, bool]:
    return { 
        model: is_model_downloaded(
            model,
            properties.get("modelFile", ""),
            properties.get("tagsFile", ""),
            properties.get("extraFiles", []),
            properties.get("backend", "onnx")
        ) 
        for model, properties in models.items()
    }

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

def get_model_file_paths(model_repo: str, model_filename: str, tags_filename: str | None = None):
    try:
        model_path = try_to_load_from_cache(model_repo, model_filename)
        csv_path = try_to_load_from_cache(model_repo, tags_filename) if tags_filename is not None else None

        return (
            model_path if isinstance(model_path, str) else None,
            csv_path if isinstance(csv_path, str) else None
        )
    except Exception:
        return None, None
