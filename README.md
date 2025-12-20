# Linguistics Mind Map (语言学概论思维导图)

A localized, interactive mind map visualization for "Introduction to Linguistics" (语言学概论), featuring a sci-fi "Explosion" graph view and a structured "Waterfall" list view.

## Features

- **Interactive Graph**: Force-directed layout representing Chapters, Sections, and Knowledge Points.
- **Sci-Fi UI**: Modern "Starry Sky" aesthetic with glowing nodes and dynamic backgrounds.
- **Bilingual Support**: Toggle between English and Chinese (CN/EN).
- **Deep Navigation**: 3-level sidebar (Chapter -> Section -> Knowledge Point).
- **Search & Filter**: Filter by syllabus requirement (Memorize, Understand, Apply) or search by keyword.
- **Waterfall View**: A card-based alternative view for browsing content linearly.

## Usage

### Prerequisites
- Python (any version with `SimpleHTTPServer` or `http.server`)
- Basic web browser

### Running Locally

1.  **Clone the repository**.
2.  **Start the server**:
    *   **Windows**: Double-click `start.bat`.
    *   **Manual**: Run `python -m SimpleHTTPServer 8080` (Python 2) or `python -m http.server 8080` (Python 3) in the project directory.
3.  **Open Browser**: Visit [http://localhost:8080](http://localhost:8080).

## Data Update

The content is generated from Markdown files (not included in this repo by default if they are personal notes, but the structure expects them).

To update `data.json`:
1.  Place your markdown files in `md/` (if configured) or ensure your source path is correct in the script.
2.  Run the update script:
    ```bash
    python update_data_script.py
    ```

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Visualization**: `force-graph` (based on ThreeJS/d3).
- **Icons**: FontAwesome 6.
- **Backend (Data)**: Python script for parsing Markdown to JSON.

## License

[MIT](LICENSE)
