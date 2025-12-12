# LLM Context Files

This folder contains documentation artifacts designed to help local LLM models (Qwen, Ollama, DeepSeek, etc.) understand the Gellyscope codebase without scanning source files.

> **Note for Claude**: This folder should be ignored during normal operation. Only read these files when explicitly asked about LLM context or when the user specifically requests it.

## Files Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| `CODEBASE.md` | Project overview, structure, tech stack | Start here for general understanding |
| `API.md` | Function signatures and module APIs | When implementing features or fixing bugs |
| `DATA_FORMATS.md` | SVG, G-code, and state structures | When working with data transformations |
| `ARCHITECTURE.md` | System design and data flow | When understanding how components connect |

## Usage Guide

### Quick Start
Copy the contents of `CODEBASE.md` into your LLM prompt for a general overview. Add other files as needed based on your task.

### Example Prompts

**General questions:**
```
[Paste CODEBASE.md]

Question: How do I add a new tab to the application?
```

**Implementation tasks:**
```
[Paste CODEBASE.md]
[Paste API.md]

Task: Add a batch export feature to the vectors tab
```

**Data structure work:**
```
[Paste DATA_FORMATS.md]

Question: How should I structure the output when parsing a new SVG element type?
```

**Architecture understanding:**
```
[Paste ARCHITECTURE.md]

Question: How does data flow from image capture to G-code generation?
```

### Combining Files
For complex tasks, combine multiple context files:
```
[Paste CODEBASE.md]
[Paste ARCHITECTURE.md]
[Paste API.md]

Task: Implement a new image filter with proper state management
```

## Context Size Considerations

| File | Approximate Tokens |
|------|-------------------|
| CODEBASE.md | ~1,500 |
| API.md | ~2,000 |
| DATA_FORMATS.md | ~800 |
| ARCHITECTURE.md | ~1,200 |
| **Total** | ~5,500 |

If your LLM has limited context, prioritize:
1. `CODEBASE.md` (always include)
2. The file most relevant to your task
3. Additional files as context allows

## Keeping Documentation Updated

These files should be updated when:
- New modules are added
- Public APIs change significantly
- New data formats are introduced
- Architecture patterns are modified

Run a diff against source files periodically to identify drift.
