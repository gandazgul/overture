# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "google-genai",
#     "python-dotenv",
# ]
# ///

import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Ensure the output directory exists
OUTPUT_DIR = "public/assets"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Define the assets and their prompts
# Each item contains: filename, prompt, and aspect_ratio
ASSETS_TO_GENERATE = [
    # 1. Primary Patron Types (Card Illustrations) - Aspect Ratio: 3:4
    {
        "filename": "patron_standard.png",
        "prompt": "A charming, stylized 2D digital illustration of a 1920s everyday theatergoer, dressed in a neat vintage suit, looking attentively forward. Warm theater lighting. Art Deco illustration style, clean lines, vibrant but elegant color palette, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "patron_vip.png",
        "prompt": "A charming, stylized 2D digital illustration of a glamorous 1920s celebrity VIP in a sparkling gown and fur boa, looking haughty and fabulous. Warm theater lighting. Art Deco illustration style, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "patron_lovebirds.png",
        "prompt": "A charming, stylized 2D digital illustration of a romantic couple in 1920s attire leaning in close, sharing a box of popcorn. Warm theater spotlight. Art Deco illustration style, clean lines, cozy and affectionate mood, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "patron_kid.png",
        "prompt": "A charming, stylized 2D digital illustration of a school boy in vintage 1920s clothes, excitedly pointing. Came to the theater as a school trip. Warm theater lighting. Art Deco illustration style, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "patron_teacher.png",
        "prompt": "A charming, stylized 2D digital illustration of a strict but caring chaperone teacher from the 1920s, wearing modest vintage clothing and holding a schedule. Warm theater lighting. Art Deco illustration style, clean lines, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "patron_critic.png",
        "prompt": "A charming, stylized 2D digital illustration of a snooty, older theater critic in a tuxedo, holding up a notepad and pen, looking skeptical. Warm theater lighting. Art Deco illustration style, clean lines, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "3:4"
    },

    # 2. Secondary Trait Badges (UI Icons) - Aspect Ratio: 1:1
    {
        "filename": "badge_tall.png",
        "prompt": "A stylized 2D UI icon of a very tall vintage 1920s formal top hat. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "badge_short.png",
        "prompt": "A stylized 2D UI icon of a vintage 1920s plush velvet theater booster cushion. Art Deco vector illustration style, elegant gold and crimson colors, bold lines, plain solid dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "badge_bespectacled.png",
        "prompt": "A stylized 2D UI icon of an elegant pair of 1920s round gold-rimmed spectacles. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "badge_noisy.png",
        "prompt": "A stylized 2D UI icon of an ornate vintage 1920s brass megaphone with stylized sound waves. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        "aspect_ratio": "1:1"
    },

    # 3. Theater Boards (Background Mats) - Aspect Ratio: 16:9
    {
        "filename": "bg_grand_empress.png",
        "prompt": "A top-down stylized view of a grand 1920s theater floor. Plush red carpet, ornate gold trim on the edges, warm ambient lighting. Elegant Art Deco geometric patterns on the floor. UI background illustration.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_blackbox.png",
        "prompt": "A top-down stylized view of a modern, minimalist blackbox theater floor. Scuffed black wooden floorboards, subtle overhead spotlight beams cutting through dark dust motes. Moody atmospheric UI background.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_royal_theatre.png",
        "prompt": "A top-down stylized view of an opulent royal theater floor. Deep purple carpets with intricate gold leaf embroidery, rich mahogany wood borders, extremely luxurious and regal. UI background illustration.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_amphitheater.png",
        "prompt": "A top-down stylized view of an ancient Greek-style amphitheater floor. Weathered stone steps and marble paving, sunlit daytime atmosphere, subtle ivy creeping on the edges. UI background illustration.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_cabaret.png",
        "prompt": "A top-down stylized view of a smoky 1920s cabaret club floor. Rich dark hardwood flooring, subtle checkered tile patterns, warm pink and amber club lighting reflecting off the floor. UI background illustration.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_balcony.png",
        "prompt": "A top-down stylized view of a theater showing a distinct split. The top edge features an ornate brass balcony railing overlooking a lower velvet carpeted floor. Rich crimson and gold tones. UI background illustration.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "bg_promenade.png",
        "prompt": "A top-down stylized view of a modern theater floor with swirling, asymmetric carpet patterns in teal and copper. Avant-garde theater interior, sleek and intriguing. UI background illustration.",
        "aspect_ratio": "16:9"
    },

    # 4. Game UI & Extras - Varies
    {
        "filename": "card_back.png",
        "prompt": "A 2D stylized playing card back featuring an elegant Art Deco geometric pattern of a theater stage curtain and marquee stars. Symmetrical, classic playing card design, rich gold, black, and red colors.",
        "aspect_ratio": "3:4"
    },
    {
        "filename": "ui_stage.png",
        "prompt": "A top-down 2D stylized view of a vintage mahogany wooden theater stage edge fitted with classic brass clam-shell footlights. Art Deco vector illustration style, elegant, solid dark background.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "ui_logo.png",
        "prompt": "A glowing 1920s Art Deco theater marquee sign serving as a game title logo reading 'Theater Card Game'. High quality vector illustration, solid dark background.",
        "aspect_ratio": "16:9"
    },
    {
        "filename": "usher_blue.png",
        "prompt": "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp blue vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "usher_red.png",
        "prompt": "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp red vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "usher_green.png",
        "prompt": "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp green vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "1:1"
    },
    {
        "filename": "usher_orange.png",
        "prompt": "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp orange vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        "aspect_ratio": "1:1"
    }
]

def main():
    load_dotenv()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: Please set the GEMINI_API_KEY environment variable in a .env file or your environment.")
        print("Example: GEMINI_API_KEY='your_api_key_here'")
        print("Then run: uv run scripts/generate_assets.py")
        return

    # Initialize the Gemini client
    client = genai.Client(api_key=api_key)
    model_name = "imagen-4.0-generate-001"

    print(f"Loaded {len(ASSETS_TO_GENERATE)} assets to generate.")

    for asset in ASSETS_TO_GENERATE:
        filename = asset["filename"]
        prompt = asset["prompt"]
        aspect_ratio = asset["aspect_ratio"]
        output_path = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(output_path):
            print(f"Skipping {filename} - already exists.")
            continue

        print(f"Generating {filename}...")
        try:
            result = client.models.generate_images(
                model=model_name,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/png",
                    aspect_ratio=aspect_ratio,
                    person_generation="ALLOW_ADULT" # To allow people descriptions (1920s theatergoer, child, etc)
                )
            )

            if not result.generated_images:
                print(f"Failed: No image returned for {filename}")
                continue

            # Save the image to the specified output path
            for generated_image in result.generated_images:
                with open(output_path, "wb") as f:
                    f.write(generated_image.image.image_bytes)
                print(f"✅ Saved {filename}")
                break # Only grabbing the first image

        except Exception as e:
            print(f"❌ Error generating {filename}: {e}")

    print("Image generation loop complete!")

if __name__ == "__main__":
    main()
