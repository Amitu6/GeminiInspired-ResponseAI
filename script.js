document.addEventListener("DOMContentLoaded", () => {
    const typingForm = document.querySelector(".typing-form");
    const typingInput = document.querySelector(".typing-input"); // Added a reference to the typing input
    const chatList = document.querySelector(".chat-list");
    const suggestions = document.querySelectorAll(".suggestion-list .suggestion");
    const toggleThemeButton = document.querySelector("#toggle-theme-button");
    const deleteChatButton = document.querySelector("#delete-chat-button");
    const voiceSearchButton = document.querySelector("#voice-search-button");
    const speechStatus = document.querySelector("#speech-status");

    let userMessage = null;
    let isResponseGenerating = false;
    let recognitionActive = false;
    let recognition = null;

    // API configuration
    const API_KEY = "AIzaSyCVU1tjZjFTHbTZfauHyL-PfMX3RHig7X8";  // Replace with your actual API key
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;

    const loadLocalstorageData = () => {
        const savedChats = localStorage.getItem("savedChats");
        const isLightMode = (localStorage.getItem("themeColor") === "light_mode");
        
        // Apply the stored theme
        document.body.classList.toggle("light_mode", isLightMode);
        toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
        
        // Restore saved chats
        chatList.innerHTML = savedChats || "";
        document.body.classList.toggle("hide-header", !!savedChats);
        chatList.scrollTo(0, chatList.scrollHeight); // Scroll to the bottom
    };

    loadLocalstorageData();

    const createMessageElement = (content, ...classes) => {
        const div = document.createElement("div");
        div.classList.add("message", ...classes);
        div.innerHTML = content;
        return div;
    };

    const showTypingEffect = (text, textElement, incomingMessageDiv) => {
        const words = text.split(' ');
        let currentWordIndex = 0;
    
        const typingInterval = setInterval(() => {
            textElement.innerText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex++];
            incomingMessageDiv.querySelector(".icon").classList.add("hide");
    
            if (currentWordIndex === words.length) {
                clearInterval(typingInterval);
                isResponseGenerating = false;
                incomingMessageDiv.querySelector(".loading-indicator").remove(); // Remove the loading indicator
                incomingMessageDiv.querySelector(".icon").classList.remove("hide");
                localStorage.setItem("savedChats", chatList.innerHTML);
                chatList.scrollTo(0, chatList.scrollHeight);
            }
        }, 75);
    };

    const generateAPIResponse = async (incomingMessageDiv) => {
        const textElement = incomingMessageDiv.querySelector(".text");
        
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: userMessage }]
                    }]
                })
            });
    
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || "Unknown error occurred.");
            }
    
            const candidates = data.candidates;
            if (!candidates || !candidates[0]?.content?.parts?.[0]?.text) {
                throw new Error("Unexpected response structure or content missing.");
            }
    
            const apiResponse = candidates[0].content.parts[0].text;
            showTypingEffect(apiResponse, textElement, incomingMessageDiv);
        } catch (error) {
            isResponseGenerating = false;
            console.error("Error fetching API response:", error);
            textElement.innerText = error.message || "Something went wrong!";
            textElement.classList.add("error");
            incomingMessageDiv.querySelector(".loading-indicator").remove(); // Remove loading indicator on error
        } finally {
            incomingMessageDiv.classList.remove("loading");
        }
    };

    const showLoadingAnimation = () => {
        const html = `<div class="message-content">
            <img src="images/gemini.svg" alt="Gemini Image" class="avatar">
            <p class="text"></p>
            <div class="loading-indicator">
                <div class="loading-bar"></div>
                <div class="loading-bar"></div>
                <div class="loading-bar"></div>
            </div>
        </div>
        <span onclick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;
        
        const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
        chatList.appendChild(incomingMessageDiv);

        chatList.scrollTo(0, chatList.scrollHeight);   
        generateAPIResponse(incomingMessageDiv);
    };

    const copyMessage = (copyIcon) => {
        const messageText = copyIcon.parentElement.querySelector(".text").innerText;
        navigator.clipboard.writeText(messageText);
        copyIcon.innerText = "done";
        setTimeout(() => copyIcon.innerText = "content_copy", 1000);
    };

    const handleOutgoingChat = () => {
        userMessage = typingInput.value.trim(); // Update the userMessage with the input field value

        if (!userMessage || isResponseGenerating) return;

        isResponseGenerating = true;

        const html = `<div class="message-content">
            <img src="images/user.jpg" alt="User Image" class="avatar">
            <p class="text"></p>
        </div>`;

        const outgoingMessageDiv = createMessageElement(html, "outgoing");
        outgoingMessageDiv.querySelector(".text").innerText = userMessage;
        chatList.appendChild(outgoingMessageDiv);

        typingForm.reset();
        chatList.scrollTo(0, chatList.scrollHeight);
        document.body.classList.add("hide-header");
        setTimeout(showLoadingAnimation, 500);
    };

    const handleVoiceInput = (transcript) => {
        userMessage = transcript;
        typingInput.value = userMessage; // Set the chat box with spoken text
    };

    suggestions.forEach(suggestion => {
        suggestion.addEventListener("click", () => {
            userMessage = suggestion.querySelector(".text").innerText;
            handleOutgoingChat();
        });
    });

    toggleThemeButton.addEventListener("click", () => {
        const isLightMode = document.body.classList.toggle("light_mode");
        localStorage.setItem("themeColor", isLightMode ? "light_mode" : "dark_mode");
        toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
    });

    deleteChatButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all messages?")) {
            localStorage.removeItem("savedChats");
            loadLocalstorageData();
        }
    });

    typingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleOutgoingChat();
    });

    const setupRecognition = () => {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log('Voice recognition started');
            voiceSearchButton.innerText = "mic_off"; // Change icon to mic_off when recognition is active
            speechStatus.innerText = "Speak now"; // Show "Speak now" message
            recognitionActive = true;
        };

        recognition.onresult = event => {
            const transcript = event.results[0][0].transcript;
            handleVoiceInput(transcript);
            recognition.stop();
        };

        recognition.onerror = error => {
            console.error('Recognition error:', error);
            recognition.stop();
        };

        recognition.onend = () => {
            console.log('Voice recognition ended');
            voiceSearchButton.innerText = "mic"; // Change icon back to mic
            speechStatus.innerText = ""; // Clear speech status message
            recognitionActive = false;
        };
    };

    setupRecognition();

    voiceSearchButton.addEventListener("click", () => {
        if (recognitionActive) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
});
