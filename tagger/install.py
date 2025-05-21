from pathlib import Path
import importlib.util
import subprocess
import sys
import re
import os

def parse_requirements():
    package_names = []

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
        install_process = subprocess.Popen([python, '-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check', '-r', 'requirements.txt'])
        install_process.wait()

if __name__ == '__main__':
    install_requirements()