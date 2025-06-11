from pathlib import Path
import importlib.util
import subprocess
import sys
import re
import os

def parse_requirements() -> list[str]:
    package_names: list[str] = []

    try:
        with open('requirements.txt', 'r') as file:
            for line in file:
                line = line.strip()

                if not line or line.startswith('--'):
                    continue

                pkg = re.split(r'[<>=~!]', line)[0].strip()
                if pkg == 'pillow':
                    pkg = 'PIL'
                elif pkg == 'onnxruntime-gpu':
                    pkg = 'onnxruntime'

                package_names.append(pkg)
    except FileNotFoundError:
        print('requirements.txt not found, skipping dependency detection')

    return package_names

def are_dependencies_installed():
    for dependency in parse_requirements():
        if importlib.util.find_spec(dependency) is None:
            return False

    return True

def install_requirements():
    os.chdir(Path(__file__).parent)

    python = sys.executable
    dependencies_installed = are_dependencies_installed()

    if not dependencies_installed:
        print('Installing requirements, do not stop the process...')
        try:
            install_process = subprocess.Popen([
                python,
                '-m',
                'pip',
                'install',
                '--no-warn-script-location',
                '--disable-pip-version-check',
                '-r',
                'requirements.txt',
            ])
        except Exception as e:
            print(f'Failed to launch pip: {e}')
            sys.exit(1)

        try:
            install_process.wait()
        except Exception as e:
            print(f'Installation process failed: {e}', file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    install_requirements()