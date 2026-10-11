"""Rebuilds the VK deploy package: copies index.html into deploy-vk/build and zips it.
Run from bakery-merge/:  python3 tools/make-vk-package.py 1.0"""
import os, shutil, sys, zipfile
ver = sys.argv[1] if len(sys.argv) > 1 else 'dev'
os.makedirs('deploy-vk/build', exist_ok=True)
shutil.copy('index.html', 'deploy-vk/build/index.html')
os.makedirs('builds/vk', exist_ok=True)
out = f'builds/vk/pyshka-vk-deploy-v{ver}.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('deploy-vk'):
        dirs[:] = [d for d in dirs if d != 'node_modules']
        for f in files:
            if f == 'package-lock.json': continue
            p = os.path.join(root, f)
            z.write(p, os.path.join('pyshka-vk-deploy', os.path.relpath(p, 'deploy-vk')))
with zipfile.ZipFile(f'builds/vk/pyshka-vk-hosting-v{ver}.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    z.write('index.html', 'index.html')
print('wrote', out)
