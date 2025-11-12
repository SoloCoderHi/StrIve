# Premium Design System - Strive

## Overview
This document outlines the premium design system implemented for Strive, featuring Google Fonts, Material Icons, and a sophisticated dark theme.

## 🎨 Design Philosophy

### Core Principles
- **Premium & Elegant**: Sophisticated dark theme with subtle gradients
- **Modern & Clean**: Minimalist approach with purposeful animations
- **Consistent**: Unified visual language across all components
- **Accessible**: High contrast ratios and clear visual hierarchy

## 📐 Typography

### Font Families

#### Display Font - Playfair Display
- **Usage**: Headers, hero titles, logo
- **Weights**: 600, 700, 800
- **CSS Variable**: `--font-display`
- **Class**: `.font-display`

```css
font-family: 'Playfair Display', serif;
```

#### Primary Font - Inter
- **Usage**: Body text, UI elements, descriptions
- **Weights**: 300, 400, 500, 600, 700, 800, 900
- **CSS Variable**: `--font-primary`
- **Class**: `.font-primary`

```css
font-family: 'Inter', -apple-system, sans-serif;
```

#### Secondary Font - Poppins
- **Usage**: Buttons, labels, navigation
- **Weights**: 300, 400, 500, 600, 700, 800
- **CSS Variable**: `--font-secondary`
- **Class**: `.font-secondary`

```css
font-family: 'Poppins', sans-serif;
```

## 🎯 Icons

### Google Material Symbols
Two icon sets are integrated:
- **Material Icons**: Classic filled icons
- **Material Symbols Outlined**: Modern outlined style

### Usage Examples

```jsx
// Basic icon
<span className="material-symbols-outlined">search</span>

// With custom styling
<span className="material-symbols-outlined text-red-600 text-3xl">
  local_movies
</span>
```

### Common Icons Used
- `local_movies` - App logo
- `search` - Search functionality
- `home`, `movie`, `tv` - Navigation
- `play_circle` - Play button
- `star` - Ratings
- `account_circle` - User profile
- `logout`, `settings` - User menu
- `delete` - Remove actions

## 🎨 Color System

### Background Colors
```css
--color-bg-primary: #000000      /* AMOLED Pure Black - Main background */
--color-bg-elevated: #141414     /* Elevated surfaces */
--color-bg-surface: #1C1C1E      /* Card surfaces */
--color-bg-card: #1F1F23         /* Card backgrounds */
--color-bg-hover: #252529        /* Hover states */
```

### Text Colors
```css
--color-text-primary: #FFFFFF    /* Primary text */
--color-text-secondary: #B3B3B3  /* Secondary text */
--color-text-tertiary: #737373   /* Tertiary text */
--color-text-muted: #4A4A4A      /* Muted text */
```

### Accent Colors
```css
--color-accent-primary: #E50914  /* Primary red */
--color-accent-secondary: #FFB800 /* Gold accent */
--color-accent-hover: #F40612    /* Red hover */
--color-accent-active: #C20813   /* Red active */
```

## 🧩 Components

### Glass Morphism Effect
Creates a frosted glass appearance with backdrop blur.

```jsx
<div className="glass-effect">
  /* Your content */
</div>
```

**CSS:**
```css
.glass-effect {
  background: rgba(28, 28, 30, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
}
```

### Premium Cards
```jsx
<div className="premium-card">
  /* Card content */
</div>
```

**Features:**
- Subtle borders
- Smooth hover transitions
- Elevated shadow on hover
- Slight upward movement

### Buttons

#### Primary Button
```jsx
<button className="btn-primary">
  <span className="material-symbols-outlined">login</span>
  <span>Sign In</span>
</button>
```

#### Secondary Button
```jsx
<button className="btn-secondary">
  Cancel
</button>
```

### Gradient Text
```jsx
<h1 className="gradient-text">Premium Title</h1>
<h2 className="gradient-accent">Accent Title</h2>
```

## 🎬 Animations

### Fade In Animation
```jsx
<div className="animate-fade-in">
  /* Content appears smoothly */
</div>
```

### Transition Speeds
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1)
```

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Container Max Width
- `--max-content-width: 1600px`

### Gutters
- Mobile/Tablet: `--gutter-size: 24px`
- Desktop: `--gutter-size-lg: 40px`

## 🎨 Usage Examples

### Header with Premium Design
```jsx
<header className="glass-effect">
  <div className="flex items-center gap-3">
    <span className="material-symbols-outlined text-4xl text-red-600">
      local_movies
    </span>
    <span className="font-display text-3xl gradient-text">
      STRIVE
    </span>
  </div>
</header>
```

### Movie Card
```jsx
<div className="premium-card">
  <img src={posterUrl} alt={title} />
  <div className="glass-effect">
    <span className="material-symbols-outlined">star</span>
    <span className="font-secondary">{rating}</span>
  </div>
</div>
```

### Form Input
```jsx
<div className="relative">
  <span className="material-symbols-outlined">mail</span>
  <input 
    className="glass-effect focus:border-red-600 font-secondary"
    type="email"
    placeholder="Enter your email"
  />
</div>
```

## 🔧 Custom Scrollbar

Premium styled scrollbar for desktop:
```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-elevated);
}

::-webkit-scrollbar-thumb {
  background: var(--color-bg-surface);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-bg-hover);
}
```

## 📋 Best Practices

### Typography
1. Use `font-display` for headlines and hero text
2. Use `font-primary` for body text and descriptions
3. Use `font-secondary` for buttons and UI elements
4. Maintain proper hierarchy with font sizes

### Colors
1. Always use CSS variables for colors
2. Ensure sufficient contrast for accessibility
3. Use accent colors sparingly for emphasis
4. Leverage opacity for depth and layering

### Icons
1. Use outlined icons for a cleaner look
2. Size icons appropriately for context
3. Apply consistent spacing around icons
4. Color icons to match the design intent

### Animations
1. Use subtle animations for better UX
2. Respect user motion preferences
3. Keep animations under 400ms for responsiveness
4. Use easing functions for natural movement

### Spacing
1. Use Tailwind's spacing scale consistently
2. Maintain adequate whitespace
3. Group related elements
4. Use the gutter system for page margins

## 🚀 Implementation Checklist

- [x] Google Fonts integrated (Inter, Poppins, Playfair Display)
- [x] Material Icons setup
- [x] CSS variables defined
- [x] Glass morphism effects
- [x] Premium button styles
- [x] Custom scrollbar
- [x] Gradient text utilities
- [x] Animation keyframes
- [x] Responsive containers
- [x] Component examples

## 📦 Dependencies

### Google Fonts
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
```

### Material Icons
```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
```

## 🎯 Next Steps

1. Apply design system to remaining components
2. Create reusable component library
3. Add dark/light theme toggle (optional)
4. Implement accessibility features
5. Performance optimization for animations
6. Create design tokens documentation

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintained by**: Strive Development Team
