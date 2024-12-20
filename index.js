class ChatBot {
    constructor() {
        // DOM Elements
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-btn');
        this.fileUpload = document.getElementById('file-upload');
        this.attachmentPreview = document.getElementById('attachment-preview');
        this.clearChatButton = document.getElementById('clear-chat');
        this.toggleSoundButton = document.getElementById('toggle-sound');
        this.messageSound = document.getElementById('message-sound');
        this.settingsButton = document.getElementById('settings-btn');
        this.settingsPanel = document.getElementById('settings-panel');
        this.systemPrompt = document.getElementById('system-prompt');
        this.saveSettingsButton = document.getElementById('save-settings');

        // State
        this.attachments = [];
        this.soundEnabled = true;
        this.systemPromptText = localStorage.getItem('systemPrompt') || '';
        
        // API key
        this.API_KEY = 'AIzaSyCp59AnJSl3d5KxUrmT-X19qeiNxcp6bCk';
        
        this.initializeEventListeners();
        this.loadChatHistory();
        this.loadSettings();
    }

    initializeEventListeners() {
        // Message sending
        this.sendButton.onclick = () => this.handleSend();
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // File upload
        this.fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));

        // Settings and controls
        this.clearChatButton.onclick = () => this.clearChat();
        this.toggleSoundButton.onclick = () => this.toggleSound();
        this.settingsButton.onclick = () => this.toggleSettings();
        this.saveSettingsButton.onclick = () => this.saveSettings();

        // Auto-resize textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = this.userInput.scrollHeight + 'px';
        });

        // Click outside settings panel to close
        document.addEventListener('click', (e) => {
            if (!this.settingsPanel.contains(e.target) && 
                !this.settingsButton.contains(e.target) && 
                !this.settingsPanel.classList.contains('hidden')) {
                this.toggleSettings();
            }
        });
    }

    loadSettings() {
        this.systemPrompt.value = this.systemPromptText;
    }

    toggleSettings() {
        this.settingsPanel.classList.toggle('hidden');
    }

    saveSettings() {
        this.systemPromptText = this.systemPrompt.value;
        localStorage.setItem('systemPrompt', this.systemPromptText);
        this.toggleSettings();
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.toggleSoundButton.querySelector('i').className = 
            this.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        localStorage.setItem('soundEnabled', this.soundEnabled);
    }

    playMessageSound() {
        if (this.soundEnabled) {
            this.messageSound.play().catch(err => console.log('Sound play error:', err));
        }
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.chatMessages.innerHTML = '';
            localStorage.removeItem('chatHistory');
        }
    }

    loadChatHistory() {
        const history = localStorage.getItem('chatHistory');
        if (history) {
            const messages = JSON.parse(history);
            messages.forEach(msg => {
                this.addMessage(msg.sender, msg.text, [], msg.timestamp);
            });
        }
    }

    saveChatHistory() {
        const messages = Array.from(this.chatMessages.children)
            .filter(msg => !msg.classList.contains('typing'))
            .map(msg => ({
                text: msg.querySelector('.message-content').textContent,
                sender: msg.classList.contains('user') ? 'user' : 'cybro',
                timestamp: msg.querySelector('.message-timestamp').textContent
            }));
        localStorage.setItem('chatHistory', JSON.stringify(messages));
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert('File size should not exceed 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'preview-item';

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            } else {
                preview.innerHTML = `<div class="file-preview">${file.name}</div>`;
            }

            const removeBtn = document.createElement('div');
            removeBtn.className = 'remove-preview';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                preview.remove();
                this.attachments = this.attachments.filter(a => a.name !== file.name);
            };

            preview.appendChild(removeBtn);
            this.attachmentPreview.appendChild(preview);
            this.attachments.push({
                name: file.name,
                data: e.target.result,
                type: file.type
            });
        };
        reader.readAsDataURL(file);
    }

    async handleSend() {
        const message = this.userInput.value.trim();
        if (message === '' && this.attachments.length === 0) return;

        this.addMessage('user', message, this.attachments);
        
        // Clear input and attachments
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.attachments = [];
        this.attachmentPreview.innerHTML = '';

        await this.getBotResponse(message);
    }

    addMessage(sender, text, attachments = [], timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Clean and format Cybro response text
        if (sender === 'cybro') {
            // Remove markdown formatting
            text = text.replace(/\*\*/g, '')
                      .replace(/\*/g, '')
                      .replace(/```/g, '')
                      .trim();
        }
        
        content.textContent = text;

        // Add attachments if any
        attachments.forEach(attachment => {
            if (attachment.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = attachment.data;
                img.className = 'message-image';
                content.appendChild(img);
            }
        });

        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = timestamp || new Date().toLocaleTimeString();

        messageDiv.appendChild(content);
        messageDiv.appendChild(timestampDiv);
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        if (sender === 'cybro') {
            this.playMessageSound();
        }

        this.saveChatHistory();
    }

    async getBotResponse(message) {
        try {
            this.addTypingIndicator();

            const payload = {
                contents: [{
                    parts: [{
                        text: message
                    }]
                }]
            };

            // Add system prompt if available
            if (this.systemPromptText) {
                payload.contents.unshift({
                    parts: [{
                        text: this.systemPromptText + "\nPlease respond without using markdown formatting or asterisks."
                    }],
                    role: "system"
                });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();
            
            this.removeTypingIndicator();
            
            if (data.candidates && data.candidates[0].content) {
                let botResponse = data.candidates[0].content.parts[0].text;
                // Clean up the response text
                botResponse = botResponse.replace(/\*\*/g, '')
                                      .replace(/\*/g, '')
                                      .replace(/```/g, '')
                                      .trim();
                this.addMessage('cybro', botResponse);
            } else {
                this.addMessage('cybro', 'I apologize, but I encountered an error processing your request.');
            }
        } catch (error) {
            console.error('Error:', error);
            this.removeTypingIndicator();
            this.addMessage('cybro', 'I apologize, but I encountered an error processing your request.');
        }
    }

    addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message cybro typing';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = '<div class="message-content">Cybro is typing</div>';
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }
}

// Initialize the chatbot
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});
