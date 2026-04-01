import fitz  # PyMuPDF
import sys
import os

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

try:
    doc = fitz.open(pdf_path)
    print(f"Total pages: {len(doc)}")
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        # Render at 300 DPI for high resolution needed by architectural blueprints
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
        img_path = os.path.join(out_dir, f"page_{page_num + 1:03d}.png")
        pix.save(img_path)
        print(f"Saved {img_path}")
except Exception as e:
    print(f"Error: {e}")
