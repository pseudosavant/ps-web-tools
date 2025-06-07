# Wordle Solver

A sophisticated Wordle puzzle solver powered by information theory and strategic analysis. This tool helps you solve Wordle puzzles more efficiently by providing optimal word suggestions, letter frequency analysis, and position-based insights.

## 🌟 Features

### Core Functionality
- **Real-time Analysis**: Solutions update as you type your constraints
- **Information Theory Optimization**: Suggests words that eliminate the most possibilities
- **Multi-letter Yellow Support**: Enter multiple letters per position for complex scenarios
- **Complete Word Database**: Uses the official Wordle word list (12,000+ words)

### Analysis Tools
- **Optimal Next Guesses**: Strategic word recommendations with information gain scores
- **Letter Frequency Chart**: Visual breakdown of most common letters in remaining words  
- **Letter Position Heatmap**: Shows top 3 most frequent letters for each position
- **Smart Statistics**: Real-time word count and elimination percentage

### User Experience
- **Progressive Web App (PWA)**: Install on mobile devices for native app experience
- **Spoiler Protection**: Blur/reveal hints system to control how much help you see
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Keyboard Shortcuts**: Fast navigation and control
- **URL State Persistence**: Share puzzle states or bookmark progress

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
1. **Enter Green Letters**: Type confirmed letters in their correct positions
2. **Enter Yellow Letters**: Type letters that are in the word but wrong position
   - You can enter multiple letters per box (e.g., "AB" if both A and B were yellow in that position)
3. **Enter Gray Letters**: Type letters that aren't in the word at all
4. **View Suggestions**: See optimal next guesses and analysis

### Hint System
- **Blur Mode (Default)**: Hints are visible but blurred to prevent spoilers
- **Reveal on Hover**: Hover over blurred sections to peek at specific hints
- **Toggle Button**: Click "Show Hints"/"Blur Hints" to toggle blur state
- **Gradual Disclosure**: Control how much help you want to see

### Advanced Features
- **Hard Mode Support**: Follows Wordle's hard mode rules automatically
- **Strategic Scoring**: Each suggestion shows expected information gain
- **Position Analysis**: Identify which letters are most likely in each position

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|---------|
| `Ctrl + H` | Toggle hint blur |
| `Ctrl + R` | Reset all inputs |
| `Alt + Ctrl + G` | Focus green letters |
| `Alt + Ctrl + Y` | Focus yellow letters |
| `Alt + Ctrl + E` | Focus excluded letters |
| `Tab` / `Enter` | Navigate between input sections |
| `←` / `→` | Navigate within green/yellow sections |
| `Backspace` | Smart navigation (moves to previous input when empty) |
| `?` | Show keyboard shortcuts |

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
- **Debounced Analysis**: 100ms delay prevents excessive calculations
- **Efficient Algorithms**: Information theory calculations optimized for real-time use
- **Lazy Loading**: Large word lists loaded asynchronously
- **Mobile Optimized**: Compact layouts and touch-friendly interfaces

## 🎯 Algorithm Details

### Information Theory Scoring
The tool uses information theory to calculate the expected information gain for each potential guess:

1. **Pattern Analysis**: For each guess, simulate all possible response patterns
2. **Entropy Calculation**: Measure how much each guess reduces uncertainty
3. **Strategic Ranking**: Prioritize guesses that eliminate the most possibilities
4. **Answer vs. Guess**: Distinguish between possible answers and strategic elimination words

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
- Information theory-based word recommendations
- Scored by expected information gain (higher = better)
- Distinguishes between possible answers (⭐) and strategic guesses (🔍)
- Limited to top 10 suggestions for clarity

## 🔧 Customization

### Modifying Word Lists
Update the CSV URL in `script.js`:
```javascript
const response = await fetch("your-word-list-url.csv");
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