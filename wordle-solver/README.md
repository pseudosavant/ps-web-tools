# Wordle Solver

A sophisticated Wordle puzzle solver powered by expected elimination scoring and strategic analysis. This tool helps you solve Wordle puzzles more efficiently by providing optimal word suggestions, letter frequency analysis, and position-based insights.

## 🌟 Features

### Core Functionality
- **Real-time Analysis**: Solutions update as you type your constraints
- **Wordle-style Guess Grid**: Type guesses directly into a 5×6 grid (like Wordle)
- **Click/Space Color Cycling**: Mark each tile gray → yellow → green by clicking it or pressing Space
- **Expected Elimination Optimization**: Suggests words that are expected to eliminate the most possibilities
- **Multi-letter Yellow Support**: Enter multiple letters per position for complex scenarios
- **Complete Word Database**: Uses the official Wordle word list (14,000+ words)

### Analysis Tools
- **Optimal Next Guesses**: Strategic word recommendations with expected elimination scores
- **Letter Frequency Chart**: Visual breakdown of most common letters in remaining words  
- **Letter Position Heatmap**: Shows top 3 most frequent letters for each position
- **Smart Statistics**: Real-time word count and elimination percentage

### User Experience
- **Progressive Web App (PWA)**: Install on mobile devices for native app experience
- **Spoiler Protection**: Blur/reveal hints system to control how much help you see
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Keyboard Shortcuts**: Fast navigation and control
- **URL State Persistence**: Share puzzle states or bookmark progress
- **Fast Grid Navigation**: Arrow keys move between tiles; typing and backspace wrap across rows

## 🚀 Getting Started

### Online Usage
Simply visit the deployed application URL and start entering your Wordle constraints.

### Local Development
1. Clone or download the project files
2. Ensure you have the following files:
   - `index.html`
   - `styles.css` 
   - `script.js`
   - `manifest.json`
3. Open `index.html` in a web browser
4. For PWA features, serve from a local web server (e.g., `python -m http.server`)

## 📱 How to Use

### Basic Workflow
1. **Enter Guesses in the Grid**: Type letters into the 5×6 grid just like Wordle
2. **Set Tile Colors**:
   - Click a filled tile (or press `Space`) to cycle: gray → yellow → green
   - Empty tiles don’t get colored
3. **View Suggestions**: See optimal next guesses and analysis

### Hint System
- **Blur Mode (Default)**: Hints are visible but blurred to prevent spoilers
- **Reveal on Hover**: Hover over blurred sections to peek at specific hints
- **Toggle Button**: Click "Show Hints"/"Blur Hints" to toggle blur state
- **Gradual Disclosure**: Control how much help you want to see

### Advanced Features
- **Hard Mode Support**: Follows Wordle's hard mode rules automatically
- **Strategic Scoring**: Each suggestion shows expected elimination, entropy, and worst-case metrics
- **Position Analysis**: Identify which letters are most likely in each position

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|---------|
| `Ctrl + H` | Toggle hint blur |
| `Ctrl + R` | Reset all inputs |
| `?` | Show keyboard shortcuts |

### Guess Grid Keyboard Controls

| Key | Action |
|-----|--------|
| `←` `→` `↑` `↓` | Move between tiles (Left/Right wraps across rows) |
| `Space` | Cycle tile color (gray → yellow → green) |
| Type letters | Auto-advances across row and wraps to the next row |
| `Backspace` | Deletes letter; if empty, moves left and wraps to previous row |

## 🛠️ Technical Details

### Architecture
- **Vanilla JavaScript**: No framework dependencies for fast loading
- **CSS Grid/Flexbox**: Modern responsive layout
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **PWA Ready**: Manifest file and mobile optimization included

### Browser Support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **PWA**: Installable on Android and iOS devices

### Performance
- **Debounced Analysis**: 250ms delay prevents excessive calculations while typing/cycling tiles
- **Worker-based Scoring**: Non-trivial optimal guess calculations run in a Web Worker
- **Lazy Loading**: Large word lists loaded asynchronously
- **Mobile Optimized**: Compact layouts and touch-friendly interfaces

## 🎯 Algorithm Details

### Expected Elimination Scoring
The tool simulates each potential guess and ranks it with a composite score based on expected elimination, entropy, and worst-case remaining words:

1. **Pattern Analysis**: For each guess, simulate all possible response patterns
2. **Expected Remaining Words**: Calculate how many answers are expected to remain after the guess
3. **Entropy**: Reward guesses that produce high-information feedback patterns
4. **Worst Case**: Penalize guesses that can leave a large answer bucket
5. **Strategic Ranking**: Sort by a weighted composite while showing the raw metrics

### Word Filtering
- **Exact Position Matching**: Green letters must be in correct positions
- **Wrong Position Logic**: Yellow letters must be in word but not in guessed positions
- **Exclusion Rules**: Gray letters cannot appear anywhere in the word
- **Hard Mode Compliance**: Once a letter is known, it must be used in subsequent guesses

## 📊 Features in Detail

### Letter Position Heatmap
- Shows top 3 most frequent letters for each position
- Helps identify likely letter placements
- Updates in real-time as constraints change
- Hover to reveal when hints are blurred

### Frequency Analysis
- Visual bar chart of letter frequency in remaining words
- Prioritizes common letters for better guess strategy
- Responsive design prevents overlap on mobile devices

### Optimal Guesses
- Composite-ranked word recommendations
- Shows expected elimination percentage, entropy bits, and worst-case remaining words
- Distinguishes between possible answers (⭐) and strategic guesses (🔍)
- Limited to top 10 suggestions for clarity

## 🔧 Customization

### Modifying Word Lists
Update the JSON URL in `script.js`:
```javascript
const response = await fetch("your-word-list-url.json");
```

### Styling
- All styles in `styles.css` use `rem` units for consistent scaling
- CSS custom properties for easy theme modifications
- Mobile-first responsive design with progressive enhancement

### PWA Configuration
Modify `manifest.json` for different:
- App name and description
- Theme colors
- Icon URLs
- Display modes

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional word list sources
- Enhanced mobile accessibility
- Performance optimizations
- UI/UX enhancements
- Algorithm improvements

## 📄 License

This project is open source. The Wordle word list is used under fair use for educational purposes.

## 🙏 Acknowledgments

- **Wordle**: Created by Josh Wardle
- **Word List**: Official Wordle word database
- **Icons**: Font Awesome
- **Inspiration**: Information theory and game optimization research

---

**Happy Wordle Solving!** 🎯
