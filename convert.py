import sys
try:
    from PIL import Image
    img = Image.open(r"C:\Users\khush\.gemini\antigravity-ide\brain\2ef8a545-6987-4026-b002-07e0d8c668d7\media__1782369868965.jpg")
    img.save(r"C:\Users\khush\.gemini\antigravity-ide\scratch\bideros\public\logo.png", format="PNG")
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64,64), (128, 128), (256, 256)]
    img.save(r"C:\Users\khush\.gemini\antigravity-ide\scratch\bideros\public\favicon.ico", format="ICO", sizes=icon_sizes)
    print("Success")
except ImportError:
    print("PIL not installed. Trying shutil...")
    import shutil
    shutil.copy(r"C:\Users\khush\.gemini\antigravity-ide\brain\2ef8a545-6987-4026-b002-07e0d8c668d7\media__1782369868965.jpg", r"C:\Users\khush\.gemini\antigravity-ide\scratch\bideros\public\logo.png")
    shutil.copy(r"C:\Users\khush\.gemini\antigravity-ide\brain\2ef8a545-6987-4026-b002-07e0d8c668d7\media__1782369868965.jpg", r"C:\Users\khush\.gemini\antigravity-ide\scratch\bideros\public\favicon.ico")
    print("Copied files instead")
