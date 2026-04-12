#!/usr/bin/env python3
"""
TRESR Mockup Generator
Based on BALLN's mockup_generator_v2.py

Workflow:
1. Takes a design image (AI-generated or uploaded)
2. Removes black/dark background
3. Composites onto t-shirt template
4. Outputs final mockup ready for Shopify
"""

from PIL import Image
import os
import sys
import json

# Default paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKGROUNDS_DIR = os.path.join(SCRIPT_DIR, '..', 'backgrounds')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, '..', 'output')

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)


def remove_background(img, threshold=35, mode='black'):
    """
    Remove background from design image.

    Args:
        img: PIL Image
        threshold: Color threshold for background detection
        mode: 'black' removes dark pixels, 'white' removes light pixels
    """
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []

    for item in data:
        if mode == 'black':
            # Remove near-black pixels (common for AI-generated designs)
            if item[0] < threshold and item[1] < threshold and item[2] < threshold:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        elif mode == 'white':
            # Remove near-white pixels
            if item[0] > (255 - threshold) and item[1] > (255 - threshold) and item[2] > (255 - threshold):
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        else:
            new_data.append(item)

    img.putdata(new_data)
    return img


def create_mockup(
    design_path,
    output_path=None,
    background_path=None,
    design_width_percent=0.35,
    design_y_offset=430,
    remove_bg=True,
    bg_mode='black',
    bg_threshold=35
):
    """
    Create a mockup by placing design on t-shirt template.

    Args:
        design_path: Path to design image
        output_path: Path for output mockup (auto-generated if None)
        background_path: Path to t-shirt template (uses default if None)
        design_width_percent: Design width as percentage of background (0.35 = 35%)
        design_y_offset: Pixels from top to place design
        remove_bg: Whether to remove background from design
        bg_mode: 'black' or 'white' background removal
        bg_threshold: Threshold for background detection

    Returns:
        Path to generated mockup
    """
    # Set defaults
    if background_path is None:
        background_path = os.path.join(BACKGROUNDS_DIR, 'FINAL-w-TEE.png')

    if output_path is None:
        design_name = os.path.splitext(os.path.basename(design_path))[0]
        output_path = os.path.join(OUTPUT_DIR, f'mockup-{design_name}.png')

    # Load images
    print(f"Loading background: {background_path}")
    background = Image.open(background_path).convert("RGBA")

    print(f"Loading design: {design_path}")
    design = Image.open(design_path).convert("RGBA")

    bg_width, bg_height = background.size
    print(f"Background size: {bg_width}x{bg_height}")

    # Remove background from design if requested
    if remove_bg:
        print(f"Removing {bg_mode} background (threshold: {bg_threshold})")
        design = remove_background(design, threshold=bg_threshold, mode=bg_mode)

    # Resize design to target width
    design_target_width = int(bg_width * design_width_percent)
    design_ratio = design_target_width / design.width
    design_target_height = int(design.height * design_ratio)
    design = design.resize((design_target_width, design_target_height), Image.LANCZOS)
    print(f"Design resized to: {design_target_width}x{design_target_height}")

    # Calculate position (centered horizontally, fixed Y offset)
    design_x = (bg_width - design.width) // 2
    design_y = design_y_offset
    print(f"Design position: ({design_x}, {design_y})")

    # Composite design onto background
    background.paste(design, (design_x, design_y), design)

    # Save output
    background.save(output_path, "PNG")
    print(f"Mockup saved: {output_path}")

    return output_path


def batch_create_mockups(designs_dir, output_dir=None, **kwargs):
    """
    Create mockups for all designs in a directory.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR

    os.makedirs(output_dir, exist_ok=True)

    results = []
    for filename in os.listdir(designs_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            design_path = os.path.join(designs_dir, filename)
            output_name = f"mockup-{os.path.splitext(filename)[0]}.png"
            output_path = os.path.join(output_dir, output_name)

            try:
                result = create_mockup(design_path, output_path, **kwargs)
                results.append({'input': design_path, 'output': result, 'status': 'success'})
            except Exception as e:
                results.append({'input': design_path, 'error': str(e), 'status': 'failed'})
                print(f"Error processing {filename}: {e}")

    return results


def create_lifestyle_mockup(
    design_path,
    lifestyle_background_path,
    output_path=None,
    shirt_template_path=None,
    design_width_percent=0.35,
    design_y_offset=520,
    shirt_width_percent=1.02,
    shirt_y_offset=-10,
    remove_bg=True,
    bg_mode='black',
    bg_threshold=35,
    output_size=1024
):
    """
    Create lifestyle mockup using BALLN workflow:
    1. Design -> composite onto blank-black-tee-whitebg.png
    2. Remove white background from shirt
    3. Place shirt+design onto lifestyle background

    OUTPUT IS ALWAYS 1:1 SQUARE (1024x1024)
    """
    # Use the transparent blank shirt (no white bg removal needed)
    if shirt_template_path is None:
        shirt_template_path = os.path.join(BACKGROUNDS_DIR, 'blank-black-tee-transparent.png')

    if output_path is None:
        design_name = os.path.splitext(os.path.basename(design_path))[0]
        output_path = os.path.join(OUTPUT_DIR, f'lifestyle-mockup-{design_name}.png')

    # Step 1: Load and prepare design (remove black background)
    print(f"Loading design: {design_path}")
    design = Image.open(design_path).convert("RGBA")

    if remove_bg:
        print(f"Removing {bg_mode} background from design (threshold: {bg_threshold})")
        design = remove_background(design, threshold=bg_threshold, mode=bg_mode)

    # Step 2: Load blank shirt template
    print(f"Loading shirt template: {shirt_template_path}")
    shirt = Image.open(shirt_template_path).convert("RGBA")
    shirt_width, shirt_height = shirt.size
    print(f"Shirt size: {shirt_width}x{shirt_height}")

    # Step 3: Resize design using MAX DIMENSION for consistent sizing
    # This ensures designs look similar regardless of aspect ratio
    design_max_size = int(shirt_width * design_width_percent)
    if design.width >= design.height:
        # Wide design - constrain by width
        design_ratio = design_max_size / design.width
    else:
        # Tall design - constrain by height
        design_ratio = design_max_size / design.height
    design_target_width = int(design.width * design_ratio)
    design_target_height = int(design.height * design_ratio)
    design = design.resize((design_target_width, design_target_height), Image.LANCZOS)
    print(f"Design resized to: {design_target_width}x{design_target_height} (max dim: {design_max_size})")

    # Center design horizontally, position at chest
    design_x = (shirt_width - design.width) // 2
    design_y = design_y_offset
    print(f"Design position on shirt: ({design_x}, {design_y})")

    # Composite design onto shirt
    shirt_with_design = shirt.copy()
    shirt_with_design.paste(design, (design_x, design_y), design)

    # Step 4: Load lifestyle background and make it square
    print(f"Loading lifestyle background: {lifestyle_background_path}")
    lifestyle_bg = Image.open(lifestyle_background_path).convert("RGBA")

    # Crop/resize background to square
    bg_width, bg_height = lifestyle_bg.size
    if bg_width != bg_height:
        min_dim = min(bg_width, bg_height)
        left = (bg_width - min_dim) // 2
        top = (bg_height - min_dim) // 2
        lifestyle_bg = lifestyle_bg.crop((left, top, left + min_dim, top + min_dim))

    # Resize to output size
    lifestyle_bg = lifestyle_bg.resize((output_size, output_size), Image.LANCZOS)
    print(f"Background resized to: {output_size}x{output_size} (square)")

    # Step 6: Resize shirt+design to fill frame properly
    shirt_target_width = int(output_size * shirt_width_percent)
    shirt_ratio = shirt_target_width / shirt_with_design.width
    shirt_target_height = int(shirt_with_design.height * shirt_ratio)
    shirt_with_design = shirt_with_design.resize((shirt_target_width, shirt_target_height), Image.LANCZOS)
    print(f"Shirt resized to: {shirt_target_width}x{shirt_target_height}")

    # Step 7: Center shirt on background
    shirt_x = (output_size - shirt_with_design.width) // 2
    shirt_y = shirt_y_offset
    print(f"Shirt position on background: ({shirt_x}, {shirt_y})")

    # Composite shirt onto lifestyle background
    lifestyle_bg.paste(shirt_with_design, (shirt_x, shirt_y), shirt_with_design)

    # Save output
    lifestyle_bg.save(output_path, "PNG")
    print(f"Lifestyle mockup saved: {output_path} ({output_size}x{output_size})")

    return output_path


def composite_on_template(
    design_path,
    template_path,
    output_path=None,
    design_width_percent=0.32,
    design_x_offset=0,
    design_y_offset=0.28,
    remove_bg=True,
    bg_mode='black',
    bg_threshold=35
):
    """
    Composite a design onto a pre-made lifestyle template.
    The template already has the blank shirt in the scene.

    Args:
        design_path: Path to design image (white design on black background)
        template_path: Path to pre-made template (shirt already in scene)
        output_path: Path for output mockup
        design_width_percent: Design width as % of template width (0.32 = 32%)
        design_x_offset: X offset from center (0 = centered)
        design_y_offset: Y offset as % from top (0.28 = 28% from top)
        remove_bg: Whether to remove black background from design
    """
    if output_path is None:
        design_name = os.path.splitext(os.path.basename(design_path))[0]
        output_path = os.path.join(OUTPUT_DIR, f'mockup-{design_name}.png')

    # Load template
    print(f"Loading template: {template_path}")
    template = Image.open(template_path).convert("RGBA")
    tmpl_width, tmpl_height = template.size
    print(f"Template size: {tmpl_width}x{tmpl_height}")

    # Load and prepare design
    print(f"Loading design: {design_path}")
    design = Image.open(design_path).convert("RGBA")

    if remove_bg:
        print(f"Removing {bg_mode} background (threshold: {bg_threshold})")
        design = remove_background(design, threshold=bg_threshold, mode=bg_mode)

    # Resize design to fit on shirt chest area
    design_target_width = int(tmpl_width * design_width_percent)
    design_ratio = design_target_width / design.width
    design_target_height = int(design.height * design_ratio)
    design = design.resize((design_target_width, design_target_height), Image.LANCZOS)
    print(f"Design resized to: {design_target_width}x{design_target_height}")

    # Position design (centered with offsets)
    design_x = (tmpl_width - design.width) // 2 + int(design_x_offset * tmpl_width)
    design_y = int(tmpl_height * design_y_offset)
    print(f"Design position: ({design_x}, {design_y})")

    # Composite design onto template
    result = template.copy()
    result.paste(design, (design_x, design_y), design)

    # Save output
    result.save(output_path, "PNG")
    print(f"Mockup saved: {output_path}")

    return output_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Generate t-shirt mockups')
    parser.add_argument('design', help='Path to design image')
    parser.add_argument('-o', '--output', help='Output path')
    parser.add_argument('-b', '--background', help='Background template path')
    parser.add_argument('-w', '--width', type=float, default=0.35, help='Design width as decimal (default: 0.35)')
    parser.add_argument('-y', '--y-offset', type=int, default=520, help='Y offset in pixels (default: 520)')
    parser.add_argument('--no-remove-bg', action='store_true', help='Skip background removal')
    parser.add_argument('--bg-mode', choices=['black', 'white'], default='black', help='Background color to remove')
    parser.add_argument('--threshold', type=int, default=35, help='Background removal threshold')
    parser.add_argument('--json', action='store_true', help='Output result as JSON')

    # New: lifestyle mockup mode
    parser.add_argument('--lifestyle', action='store_true', help='Create lifestyle mockup (shirt on background)')
    parser.add_argument('--shirt-template', help='Path to blank shirt template (for lifestyle mode)')
    parser.add_argument('--shirt-width', type=float, default=1.02, help='Shirt width on lifestyle bg (default: 1.02)')
    parser.add_argument('--shirt-y', type=int, default=-10, help='Shirt Y offset on lifestyle bg (default: -10)')

    args = parser.parse_args()

    if args.lifestyle and args.background:
        # Two-step lifestyle mockup
        result = create_lifestyle_mockup(
            design_path=args.design,
            lifestyle_background_path=args.background,
            output_path=args.output,
            shirt_template_path=args.shirt_template,
            design_width_percent=args.width,
            design_y_offset=args.y_offset,
            shirt_width_percent=args.shirt_width,
            shirt_y_offset=args.shirt_y,
            remove_bg=not args.no_remove_bg,
            bg_mode=args.bg_mode,
            bg_threshold=args.threshold
        )
    else:
        # Standard single-step mockup
        result = create_mockup(
            design_path=args.design,
            output_path=args.output,
            background_path=args.background,
            design_width_percent=args.width,
            design_y_offset=args.y_offset,
            remove_bg=not args.no_remove_bg,
            bg_mode=args.bg_mode,
            bg_threshold=args.threshold
        )

    if args.json:
        print(json.dumps({'output': result, 'status': 'success'}))
    else:
        print(f"\nDone! Mockup created: {result}")
