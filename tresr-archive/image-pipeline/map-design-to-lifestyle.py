#!/usr/bin/env python3

"""
Map Design to Lifestyle Template
Uses perspective transformation to place designs onto lifestyle photo templates
"""

import sys
import os
from PIL import Image
import numpy as np
import cv2

# Mapping points for each template (calibrated for natural placement)
# Format: [top-left, top-right, bottom-right, bottom-left]
TEMPLATE_MAPPINGS = {
    'lifestyle-male-1-mental-health.png': {
        # Straight-on, seated at desk with journal
        'points': [(385, 430), (585, 430), (590, 660), (380, 660)],
        'description': 'Male 1 - Mental Health'
    },
    'lifestyle-male-2-developer.png': {
        # Mostly straight-on, standing in front of monitors
        'points': [(375, 445), (605, 445), (610, 690), (370, 690)],
        'description': 'Male 2 - Developer'
    },
    'lifestyle-male-3-coffee.png': {
        # Angled slightly right, holding coffee with left hand
        'points': [(345, 435), (545, 440), (545, 670), (340, 670)],
        'description': 'Male 3 - Coffee'
    },
    'lifestyle-male-4-entrepreneur.png': {
        # Slightly angled, standing in conversation
        'points': [(355, 395), (565, 400), (565, 640), (350, 640)],
        'description': 'Male 4 - Entrepreneur'
    },
    'lifestyle-female-1-mental-health.png': {
        # Looking to the side, seated with plants
        'points': [(390, 395), (600, 390), (605, 630), (385, 635)],
        'description': 'Female 1 - Mental Health'
    },
    'lifestyle-female-2-developer.png': {
        # Laughing, head turned, in front of monitors
        'points': [(360, 400), (575, 400), (575, 640), (355, 640)],
        'description': 'Female 2 - Developer'
    },
    'lifestyle-female-3-fitness.png': {
        # At gym, slightly angled, holding water bottle
        'points': [(340, 380), (545, 375), (550, 610), (335, 615)],
        'description': 'Female 3 - Fitness'
    },
    'lifestyle-female-4-entrepreneur.png': {
        # Seated at desk, glasses, looking up and to side
        'points': [(370, 375), (580, 370), (585, 610), (365, 615)],
        'description': 'Female 4 - Entrepreneur'
    }
}

def map_design_to_template(design_path, template_path, output_path, debug=False):
    """
    Map a design onto a lifestyle template using perspective transformation

    Args:
        design_path: Path to the design PNG (transparent background)
        template_path: Path to the lifestyle template
        output_path: Where to save the result
        debug: If True, shows mapping points visually

    Returns:
        Path to output file
    """

    print(f"\n🎨 Mapping design to lifestyle template")
    print(f"   Design: {os.path.basename(design_path)}")
    print(f"   Template: {os.path.basename(template_path)}")

    # Load images
    template = Image.open(template_path).convert("RGBA")
    design = Image.open(design_path).convert("RGBA")

    # Get mapping points for this template
    template_name = os.path.basename(template_path)
    if template_name not in TEMPLATE_MAPPINGS:
        print(f"   ⚠️  Warning: No calibrated mapping for {template_name}, using default")
        # Default mapping (center of 1024x1024 image)
        mapping = {
            'points': [(370, 280), (650, 280), (680, 560), (340, 560)],
            'description': 'Default'
        }
    else:
        mapping = TEMPLATE_MAPPINGS[template_name]

    print(f"   📍 Using mapping: {mapping['description']}")

    # Convert to numpy arrays for OpenCV
    design_np = np.array(design)
    template_np = np.array(template)

    # Design corner points (source)
    design_height, design_width = design_np.shape[:2]
    src_points = np.float32([
        [0, 0],                           # Top-left
        [design_width, 0],                # Top-right
        [design_width, design_height],    # Bottom-right
        [0, design_height]                # Bottom-left
    ])

    # Template mapping points (destination)
    dst_points = np.float32(mapping['points'])

    # Calculate perspective transformation matrix
    matrix = cv2.getPerspectiveTransform(src_points, dst_points)

    # Apply perspective warp to design
    warped_design = cv2.warpPerspective(
        design_np,
        matrix,
        (template_np.shape[1], template_np.shape[0]),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)
    )

    # Convert back to PIL for easier compositing
    warped_design_pil = Image.fromarray(warped_design)

    # Composite warped design onto template
    result = template.copy()
    result.paste(warped_design_pil, (0, 0), warped_design_pil)

    # Save result
    result.save(output_path, 'PNG')

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"   ✅ Saved: {output_path}")
    print(f"   📊 Size: {file_size:.2f} MB")

    # Debug mode - show mapping visualization
    if debug:
        debug_path = output_path.replace('.png', '-debug.png')
        visualize_mapping(template_path, mapping['points'], debug_path)
        print(f"   🔍 Debug visualization: {debug_path}")

    return output_path

def visualize_mapping(template_path, points, output_path):
    """
    Create a debug visualization showing where the design will be mapped
    """
    template = cv2.imread(template_path)

    # Draw the quadrilateral
    points_array = np.array(points, dtype=np.int32)
    cv2.polylines(template, [points_array], True, (0, 255, 0), 3)

    # Draw corner circles
    for i, point in enumerate(points):
        cv2.circle(template, tuple(point), 5, (255, 0, 0), -1)
        label = ['TL', 'TR', 'BR', 'BL'][i]
        cv2.putText(template, label, (point[0] + 10, point[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

    cv2.imwrite(output_path, template)

def batch_map_design(design_path, output_dir, template_dir=None):
    """
    Map a design to all 8 templates

    Args:
        design_path: Path to design PNG
        output_dir: Where to save results
        template_dir: Path to templates (default: templates/lifestyle/)

    Returns:
        List of output paths
    """
    if template_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        template_dir = os.path.join(script_dir, '../../templates/lifestyle')

    print(f"\n{'='*60}")
    print(f"🎨 BATCH MAPPING DESIGN TO ALL TEMPLATES")
    print(f"{'='*60}")
    print(f"Design: {design_path}")
    print(f"Template dir: {template_dir}")
    print(f"Output dir: {output_dir}\n")

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    results = []

    # Get all templates
    templates = sorted([f for f in os.listdir(template_dir) if f.endswith('.png')])

    for i, template_name in enumerate(templates):
        template_path = os.path.join(template_dir, template_name)
        output_name = template_name.replace('lifestyle-', 'mapped-')
        output_path = os.path.join(output_dir, output_name)

        print(f"[{i+1}/{len(templates)}] {template_name}")
        print("━" * 60)

        map_design_to_template(design_path, template_path, output_path)
        results.append(output_path)

        print()

    print(f"{'='*60}")
    print(f"✅ BATCH COMPLETE - {len(results)} images created")
    print(f"{'='*60}\n")

    return results

# CLI usage
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 map-design-to-lifestyle.py <design> <template|all> [output]")
        print()
        print("Examples:")
        print("  # Map to single template")
        print("  python3 map-design-to-lifestyle.py \\")
        print("    designs/my-design.png \\")
        print("    templates/lifestyle/lifestyle-male-1-caucasian-mental-health.png \\")
        print("    output/lifestyle-male.png")
        print()
        print("  # Map to all 8 templates")
        print("  python3 map-design-to-lifestyle.py \\")
        print("    designs/my-design.png \\")
        print("    all \\")
        print("    output/")
        print()
        print("  # Debug mode (visualize mapping points)")
        print("  python3 map-design-to-lifestyle.py \\")
        print("    designs/my-design.png \\")
        print("    templates/lifestyle/lifestyle-male-1-caucasian-mental-health.png \\")
        print("    output/lifestyle-male.png \\")
        print("    --debug")
        sys.exit(1)

    design_path = sys.argv[1]
    template_arg = sys.argv[2]
    debug = '--debug' in sys.argv

    if template_arg.lower() == 'all':
        # Batch mode
        output_dir = sys.argv[3] if len(sys.argv) > 3 else 'output/lifestyle-mapped'
        batch_map_design(design_path, output_dir)
    else:
        # Single template mode
        template_path = template_arg
        output_path = sys.argv[3] if len(sys.argv) > 3 else 'output/lifestyle-mapped.png'
        map_design_to_template(design_path, template_path, output_path, debug=debug)

    print("✅ Done!")
