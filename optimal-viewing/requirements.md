- `screen_dimension` = monitor width or height.  
- `distance` = viewing distance.  
- Output: horizontal and vertical FOV coverage.  

### 2. Monitor Size Conversion
- If **size + aspect ratio provided**:  
- Compute width and height from diagonal.  
- Formula:  
  ```
  width = diagonal * (aspect_width / sqrt(aspect_width^2 + aspect_height^2))
  height = diagonal * (aspect_height / sqrt(aspect_width^2 + aspect_height^2))
  ```

### 3. Pixel Density and Sharpness
- If **resolution provided**:  
- Compute pixels per inch (PPI).  
- Formula:  
  ```
  PPI = sqrt(res_width^2 + res_height^2) / diagonal
  ```
- Compute angular resolution (pixels per degree of vision).  
- Formula:  
  ```
  pixels_per_degree = res_width / horizontal_fov
  ```
- Compare to human acuity (~60 pixels/degree).  
- If `pixels_per_degree > 60`: resolution is **overkill**.  
- If `pixels_per_degree < 60`: resolution may look **pixelated**.

---

## Modes of Operation

### Predictive Mode (distance only)
- User provides **distance**.  
- Application outputs:
- Recommended monitor size range that fits within 60° detailed FOV.  
- Suggested aspect ratios that maximize vertical coverage.  

### Evaluation Mode (distance + monitor size and/or resolution)
- If **monitor size provided**:  
- Show how much of FOV the monitor covers.  
- Indicate if head movement is needed (e.g., monitor covers >120°).  

- If **resolution provided**:  
- Show perceived sharpness (pixels per degree vs. human limit).  
- Warn about diminishing returns or insufficient resolution.  

- If **both size and resolution provided**:  
- Combine both evaluations: immersion + sharpness.

---

## Recommendations
- Size and resolution combinations labeled as:
- ✅ Optimal: fits detailed FOV and resolution matches acuity.  
- ⚠️ Overkill: resolution exceeds acuity at given distance.  
- ⚠️ Undersharp: pixels visible at given distance.  
- ⚠️ Oversized: requires head movement to see edges.  

- Example output:
- “At 2 ft, a 27″ 1440p monitor covers 58° horizontally and provides 80 pixels/degree — optimal.”  
- “At 2 ft, a 40″ 1080p monitor covers 85° but only 30 pixels/degree — may look pixelated.”

---

## Visualization

### 2D Mode (SVG/Canvas)
- Draw two cones:
- Outer cone = 120° FOV.
- Inner cone = 60° detailed FOV.
- Overlay monitor rectangle at distance.  
- Annotate coverage angles.

### 3D Mode (WebGL)
- Virtual “room view” with monitor at chosen distance.  
- Allow user to rotate camera and see cones vs. monitor surface.  
- Toggle between aspect ratios/resolutions.  

---

## User Interface

- Input controls:
- Distance slider/text field.  
- Monitor size (optional text field).  
- Resolution dropdown.  
- Aspect ratio dropdown.  
- Mode toggle:
- **Predictive** (distance only).  
- **Evaluation** (distance + monitor size/resolution).  
- Outputs update in real time:
- Numeric recommendations.  
- Visual overlay.  
- Text warnings or confirmations.

---

## State Persistence

- All user inputs (distance, monitor size, resolution, aspect ratio, mode) must persist in the **URL query string**.  
- Example:  
  ```
  https://example.com?distance=24&size=27&resolution=1440p&ratio=16:9&mode=evaluation
  ```
- When the page is loaded or reloaded:
- Parse query string and restore all settings.  
- Ensure visualization and recommendations update automatically.  
- Changing inputs updates the URL in real time (using `history.replaceState` or similar, without page reload).

---

## Stretch Goals
- Presets for common monitors (e.g., “Dell 27″ 1440p”).  
- Export results as image or report.
