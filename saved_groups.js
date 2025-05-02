document.addEventListener('DOMContentLoaded', () => {
    const savedGroupListContainer = document.getElementById('savedGroupList');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    let allSavedGroups = []; // Cache fetched groups

    // Initial load
    renderSavedGroupList();
    setupImportExportListeners();

    async function renderSavedGroupList() {
        try {
            allSavedGroups = await MemoryStorage.getSavedTabGroups();
            savedGroupListContainer.innerHTML = ''; // Clear previous list

            if (allSavedGroups.length === 0) {
                savedGroupListContainer.innerHTML = '<p class="no-groups-msg">No tab groups saved yet.</p>';
                return;
            }

            // Sort by saved date, newest first
            allSavedGroups.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            allSavedGroups.forEach(group => {
                const groupEl = document.createElement('div');
                groupEl.className = 'saved-group-item';
                groupEl.dataset.groupId = group.id;

                const colorSpan = group.color ? `<span class="saved-group-color" style="background-color: ${group.color}"></span>` : '';

                groupEl.innerHTML = `
                    <div class="saved-group-info">
                        ${colorSpan}
                        <span class="saved-group-title">${group.title || 'Untitled Saved Group'}</span>
                        <span class="saved-group-count">(${group.tabs.length} tabs)</span>
                    </div>
                    <div class="saved-group-actions">
                        <button class="load-btn" data-group-id="${group.id}">Load Group</button>
                        <button class="delete-btn" data-group-id="${group.id}">Delete</button>
                    </div>
                `;

                groupEl.querySelector('.load-btn').addEventListener('click', handleLoadSavedGroup);
                groupEl.querySelector('.delete-btn').addEventListener('click', handleDeleteSavedGroup);

                savedGroupListContainer.appendChild(groupEl);
            });

        } catch (error) {
            console.error("Error rendering saved group list:", error);
            savedGroupListContainer.innerHTML = '<p class="error-msg">Error loading saved groups.</p>';
        }
    }

    async function handleLoadSavedGroup(event) {
        const groupId = event.target.dataset.groupId;
        const groupToLoad = allSavedGroups.find(g => g.id === groupId);

        if (!groupToLoad) {
            console.error("Could not find saved group data for ID:", groupId);
            alert("Error: Could not find group data.");
            return;
        }

        const urlsToOpen = groupToLoad.tabs.map(tab => tab.url);
        
        if (urlsToOpen.length === 0) {
            alert("This saved group has no tabs to load.");
            return;
        }

        try {
            // Create a new window with the saved tabs
            const newWindow = await chrome.windows.create({ url: urlsToOpen });
            console.log(`Opened saved group ${groupId} in new window ${newWindow.id}`);

            // Optional: Try to re-group the tabs in the new window
            if (newWindow.tabs && newWindow.tabs.length > 0 && chrome.tabs.group && chrome.tabGroups) {
                 setTimeout(async () => { // Timeout gives tabs time to load a bit
                    try {
                        const newTabIds = newWindow.tabs.map(t => t.id);
                        const createdGroupId = await chrome.tabs.group({
                            tabIds: newTabIds,
                            createProperties: { windowId: newWindow.id }
                        });
                        await chrome.tabGroups.update(createdGroupId, {
                            title: groupToLoad.title,
                            color: groupToLoad.color
                        });
                        console.log(`Re-grouped tabs in new window with group ID ${createdGroupId}`);
                    } catch(regroupError) {
                         console.warn("Could not re-apply grouping to new window:", regroupError);
                    }
                }, 1000); // Adjust timeout if needed
            }

        } catch (error) {
            console.error(`Error opening saved group ${groupId} in new window:`, error);
            alert("An error occurred while trying to load the group.");
        }
    }

    async function handleDeleteSavedGroup(event) {
        const groupId = event.target.dataset.groupId;
        const groupToDelete = allSavedGroups.find(g => g.id === groupId);

        if (!groupToDelete) {
            console.error("Could not find saved group data for deletion ID:", groupId);
            return; // Should not happen if list is rendered correctly
        }

        if (confirm(`Are you sure you want to delete the saved group "${groupToDelete.title}"?`)) {
            try {
                await MemoryStorage.deleteSavedTabGroup(groupId);
                // Re-render the list to reflect the deletion
                await renderSavedGroupList(); 
            } catch (error) {
                console.error(`Error deleting saved group ${groupId}:`, error);
                alert("An error occurred while deleting the group.");
            }
        }
    }

    // Added: Setup listeners for Import/Export buttons
    function setupImportExportListeners() {
        exportDataBtn.addEventListener('click', handleExportData);
        importDataBtn.addEventListener('click', () => {
            // Trigger the hidden file input
            importFileInput.click();
        });
        importFileInput.addEventListener('change', handleImportFileSelect);
    }

    // Added: Handle Export Button Click
    async function handleExportData() {
        try {
            console.log("Exporting data...");
            const dataToExport = await MemoryStorage.exportAllData();
            const jsonString = JSON.stringify(dataToExport, null, 2); // Pretty print JSON
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `tensigh-pro-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("Export initiated.");

        } catch (error) {
            console.error("Error exporting data:", error);
            alert("An error occurred while exporting data. Check the console for details.");
        }
    }

    // Added: Handle File Selection for Import
    function handleImportFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return; 
        }

        console.log(`Selected file: ${file.name}, Type: ${file.type}`);

        if (file.type !== 'application/json') {
            alert("Please select a valid JSON file (.json).");
            // Reset file input value in case user tries to select the same invalid file again
            importFileInput.value = null; 
            return;
        }

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const fileContent = e.target.result;
                const jsonData = JSON.parse(fileContent);
                console.log("File parsed successfully.");

                // Confirmation step
                if (confirm("WARNING: Importing this file will overwrite ALL existing memories, saved groups, stats, and settings.\n\nAre you sure you want to proceed?")) {
                    console.log("User confirmed import.");
                    await MemoryStorage.importAllData(jsonData);
                    alert("Data imported successfully!");
                    // Refresh the list view
                    await renderSavedGroupList(); 
                } else {
                    console.log("User cancelled import.");
                }

            } catch (error) {
                console.error("Error processing import file:", error);
                alert(`Error importing file: ${error.message}\nPlease ensure the file is a valid JSON export from Tensigh Pro.`);
            }
            // Reset file input value after processing (or cancellation)
            importFileInput.value = null; 
        };

        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("An error occurred while reading the file.");
            // Reset file input value on error
            importFileInput.value = null; 
        };

        reader.readAsText(file);
    }
}); 