from pathlib import Path
import importlib.util
import subprocess
import argparse
import sys
import os

def parse_arguments():
    parse = argparse.ArgumentParser()
    parse.add_argument('--skip-venv', action='store_true', help='skip venv creation')
    return parse.parse_args()

def are_dependencies_installed():
    status_file = Path('dependencies_installed')

    if status_file.exists():
        with open(status_file, 'r') as file:
            return file.read() == 'true'
    else:
        return False

def mark_dependencies_installed():
    status_file = Path('dependencies_installed')
    with open(status_file, 'w') as file:
        file.write('true')

def install_requirements():
    args = parse_arguments()
    os.chdir('tagger' if os.environ.get('NODE_ENV') == 'debug' else 'resources/tagger')

    python = sys.executable

    dependencies_installed = are_dependencies_installed()

    if not args.skip_venv:
        venv_path = Path('venv')
        if not Path.exists(venv_path) or not dependencies_installed:
            print('Creating virtual environment...')
            subprocess.check_call(f'{python} -m venv venv', shell=sys.platform == 'linux')
            venv_pip = venv_path.joinpath('Scripts/pip.exe' if sys.platform == 'win32' else 'bin/pip')
            print('Installing requirements, do not stop or restart the process...')
            subprocess.check_call(f'{venv_pip} install --disable-pip-version-check -r requirements.txt', shell=sys.platform == 'linux')
            mark_dependencies_installed()
    else:
        if not dependencies_installed:
            print('Installing requirements, do not stop or restart the process...')
            subprocess.check_call(f'{python} -m pip install --no-warn-script-location --disable-pip-version-check -r requirements.txt', shell=sys.platform == 'linux')
            mark_dependencies_installed()

install_requirements()