import os
from PIL import Image

def main():
    src_path = 'public/skull_shield.png'
    if not os.path.exists(src_path):
        print(f"Source file not found: {src_path}")
        return

    # Load source image
    img = Image.open(src_path)
    print(f"Loaded image: {src_path} (size: {img.size}, format: {img.format})")

    # Define the theme background color: #0e0e11
    bg_color = (14, 14, 17)

    # Function to create a solid icon of a given size with the theme background
    def create_solid_icon(size):
        # Create a new solid background image
        new_img = Image.new('RGB', (size, size), bg_color)
        # Resize source image to fit
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        # If the source has transparency, paste it using itself as the mask
        if img.mode == 'RGBA':
            new_img.paste(resized, (0, 0), resized)
        else:
            new_img.paste(resized, (0, 0))
        return new_img

    # 1. Favicon (32x32)
    fav = img.resize((32, 32), Image.Resampling.LANCZOS)
    fav.save('public/favicon.png', 'PNG')
    print("Generated public/favicon.png")

    # 2. Icon 192 (192x192) - full bleed with #0e0e11 background
    icon192 = create_solid_icon(192)
    icon192.save('public/icon-192.png', 'PNG')
    print("Generated public/icon-192.png")

    # 3. Icon 512 (512x512) - full bleed with #0e0e11 background
    icon512 = create_solid_icon(512)
    icon512.save('public/icon-512.png', 'PNG')
    print("Generated public/icon-512.png")

    # 4. Maskable Icon (512x512)
    # The maskable icon requires all important content to be within the 80% safe zone circle in the center.
    # We scale down the original image content (e.g. 76% of 512 = ~390px) and center it on #0e0e11.
    maskable = Image.new('RGB', (512, 512), bg_color)
    scaled_size = int(512 * 0.76) # 390px
    content_img = img.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)
    
    offset = (512 - scaled_size) // 2
    if img.mode == 'RGBA':
        maskable.paste(content_img, (offset, offset), content_img)
    else:
        maskable.paste(content_img, (offset, offset))
        
    maskable.save('public/icon-maskable.png', 'PNG')
    print("Generated public/icon-maskable.png")

if __name__ == '__main__':
    main()
