import base64

# SVG favicon for Valiant diamond logo
svg_icon = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff6b35"/>
      <stop offset="100%" style="stop-color:#ff4500"/>
    </linearGradient>
  </defs>
  <polygon points="50,5 95,50 50,95 5,50" fill="url(#g)"/>
  <polygon points="50,5 72,50 50,95 28,50" fill="#0b0d14"/>
</svg>'''

# Save SVG file
with open('valiant-logo.svg', 'w') as f:
    f.write(svg_icon)

# Create base64 for favicon
encoded = base64.b64encode(svg_icon.encode()).decode()
data_url = f"data:image/svg+xml;base64,{encoded}"

print("Icon created!")
print(f"\nFavicon URL (copy to index.html):")
print(f'<link rel="icon" href="{data_url}">')

# Save to file for reference
with open('icon-url.txt', 'w') as f:
    f.write(data_url)
