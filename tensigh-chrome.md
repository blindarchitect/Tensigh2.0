# Tensigh Pro Chrome Extension Analysis

## Summary

Tensigh Pro is a Chrome extension that functions as an advanced flashcard system. It allows users to create "memories" (flashcards) directly from selected text on web pages and review them using different study modes, including spaced repetition.

## Core Functionality

1.  **Memory Creation (Context Menu):**
    *   Users can select text on any webpage, right-click, and select "Create Memory in Tensigh Pro".
    *   This captures:
        *   Selected text (as the 'front' of the card).
        *   Surrounding text and limited HTML context (as the 'back' or context).
        *   Source URL, page title, and creation timestamp.
    *   Handled by `background.js` using the `contextMenus` and `scripting` APIs.

2.  **Storage (`storage.js` & `chrome.storage.local`):**
    *   All memories, user-defined tags, and usage statistics (creation count, review count, review streak) are stored locally using `chrome.storage.local`.
    *   `storage.js` likely provides helper functions for managing this data (CRUD operations, initialization).

3.  **Popup Interface (`popup.html`, `popup.js`, `popup.css`):**
    *   Accessed by clicking the extension icon.
    *   Acts as a dashboard displaying:
        *   Total memory count.
        *   Number of memories currently due for review.
        *   Current review streak.
    *   Lists recent memories (up to 20) with front text, creation date, source domain, and tags.
    *   Provides actions per memory: Edit (opens `edit.html`), Delete (with confirmation), Add Tag (prompts user).
    *   Includes search functionality (searches front, back, tags).
    *   Includes tag filtering via a dropdown.
    *   Allows selection of study modes (e.g., 'spaced', 'quiz').
    *   Provides buttons to:
        *   Start a review session (opens `review.html` or `quiz.html` based on selected mode).
        *   View detailed statistics (opens `stats.html`).

4.  **Reviewing (`review.html`, `review.js`, `review.css`, `spacedRepetition.js`, `studyModes.js`):**
    *   A dedicated interface (`review.html`) for studying due flashcards.
    *   Likely implements spaced repetition logic (suggested by `spacedRepetition.js` and memory properties like `nextReview`).
    *   Supports different study modes (e.g., standard review, potentially quizzes mentioned in `popup.js`, though `quiz.html` isn't present).

5.  **Editing (`edit.html`, `edit.js`):**
    *   A dedicated interface for modifying the content (front, back, tags, etc.) of existing memories. Accessed via the edit button in the popup.

6.  **Statistics (`stats.html`, `stats.js`, `stats.css`):**
    *   A dedicated page to visualize user statistics related to memory creation and review habits.

7.  **Other Potential Features (Based on file names):**
    *   `mindmap.js`: May offer functionality to visualize connections between memories or concepts as a mind map.
    *   `mediaCapture.js`: Could potentially allow capturing images or other media to associate with memories (though permissions for this aren't explicitly requested in the manifest).

## Key Files

*   `manifest.json`: Defines permissions (`contextMenus`, `storage`, `activeTab`, `scripting`), background script, popup, icons, and web-accessible resources.
*   `background.js`: Handles context menu creation and the logic for creating memories from selected text.
*   `storage.js`: Contains functions for interacting with `chrome.storage.local`.
*   `popup.html`/`popup.js`/`popup.css`: Code for the main popup interface.
*   `review.html`/`review.js`/`review.css`: Code for the flashcard review interface.
*   `edit.html`/`edit.js`: Code for the memory editing interface.
*   `stats.html`/`stats.js`/`stats.css`: Code for the statistics display interface.
*   `spacedRepetition.js`: Likely contains the logic for the spaced repetition algorithm.
*   `studyModes.js`: May define or manage different ways to study memories.
*   `content.js`: (Present but not directly referenced in manifest) Potentially used for interacting with web page content in ways not covered by the background script's `executeScript` calls, or perhaps injected dynamically.

## Permissions Used

*   `contextMenus`: To add the "Create Memory" option to the right-click menu.
*   `storage`: To save and retrieve memories, tags, and stats locally.
*   `activeTab`: To get information about the current tab (URL, title) when creating a memory.
*   `scripting`: To inject scripts into the active tab to retrieve selected text context (surrounding text, HTML).

## Notes

*   The extension uses Manifest V3.
*   The background script runs as a service worker.
*   A `quiz.html` file is referenced in `popup.js` but does not exist in the file listing, suggesting it might be a planned or removed feature. 