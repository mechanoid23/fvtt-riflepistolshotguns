let socket;
let selectedUserId;

Hooks.once("socketlib.ready", () => {
    socket = socketlib.registerModule("rockpaperscissors");
    socket.register("startRPS", startRPS);
    socket.register("otherUserRPS", otherUserRPS);
    socket.register("deleteMessageRPS", deleteMessageRPS);
    socket.register("updateMessageRPS", updateMessageRPS)
});

Hooks.on("createChatMessage", async (msg) => {
    if (msg.content !== "rps" || game.user.id !== msg.user.id) return;
    let gmOnline = false;
    await game.users.forEach(user => {
        if (user.active && user.isGM) {
            gmOnline = true;
            return;
        }
    })
    if (gmOnline) {
        await socket.executeAsUser("startRPS", msg.user.id, msg);
        await socket.executeAsGM("deleteMessageRPS", msg.id);
    }
    else {
        ChatMessage.create({ speaker: { alias: "Rifle, Pistol, Shotgun!" }, content: "Rifle, Pistol, Shotguns! only works when a GM is online.", whisper: [msg.user.id] });
    }
});

Hooks.on('renderChatMessage', async (msg, [html], messageData) => {
    if (msg.content.includes('<select id="rpsSelectUser">') && game.user.id === msg.user.id) {
        const selectElement = html.querySelector('#rpsSelectUser');
        const startButton = html.querySelector('.rpsStartButton');

        if (selectElement && startButton) {
            startButton.addEventListener('click', async (event) => {
                const selectedUserId = selectElement.value; // Get the selected value

                // Update the message content with the buttons
                Hooks.once("updateChatMessage", (msg) => {
                    const newMessage = game.messages.get(msg.id);
                    const parser = new DOMParser();
                    const newHtml = parser.parseFromString(newMessage.content, 'text/html');
                    addSelectionListeners(msg.id, newHtml);
                });
                await socket.executeAsGM("updateMessageRPS", msg.id, { content: generateRPSButtons(250) });
                await socket.executeAsUser("otherUserRPS", selectedUserId, selectedUserId, msg);
            });
        }
    }
});

Hooks.on('renderChatMessage', async (msg, [html], messageData) => {
    if (!msg.flags.rockpaperscissors) return;
    addSelectionListeners(msg.id, html);
});


function addSelectionListeners(messageid, html) {
    const rifleButton = html.querySelector('.rpsButton[data-choice="Rifle"]');
    const pistolButton = html.querySelector('.rpsButton[data-choice="Pistol"]');
    const shotgunButton = html.querySelector('.rpsButton[data-choice="Shotgun"]');
    const shootButton = html.querySelector('.rpsShootButton');
    const setSelectedChoiceBackgroundColor = (selectedChoice) => {
        const buttonElements = {
            Rifle: html.querySelector('.rpsButton[data-choice="Rifle"]'),
            Pistol: html.querySelector('.rpsButton[data-choice="Pistol"]'),
            Shotgun: html.querySelector('.rpsButton[data-choice="Shotgun"]'),
        };

        for (const choice in buttonElements) {
            if (buttonElements.hasOwnProperty(choice)) {
                buttonElements[choice].style.backgroundColor = choice === selectedChoice ? 'rgb(60, 60, 60)' : '';
            }
        }
    };
    let selectedChoice;
    if (rifleButton && pistolButton && shotgunButton) {
        rifleButton.addEventListener('click', () => {
            rifleButton.disabled = true;
            pistolButton.disabled = false;
            shotgunButton.disabled = false;
            shootButton.disabled = false;
            selectedChoice = "rifle";
            setSelectedChoiceBackgroundColor('Rifle');
        });

        pistolButton.addEventListener('click', () => {
            rifleButton.disabled = false;
            pistolButton.disabled = true;
            shotgunButton.disabled = false;
            shootButton.disabled = false;
            selectedChoice = "pistol";
            setSelectedChoiceBackgroundColor('Pistol');
        });

        shotgunButton.addEventListener('click', () => {
            rifleButton.disabled = false;
            pistolButton.disabled = false;
            shotgunButton.disabled = true;
            shootButton.disabled = false;
            selectedChoice = "shotgun";
            setSelectedChoiceBackgroundColor('Shotgun');
        });
    }
    if (shootButton) {
        shootButton.disabled = true;
        shootButton.addEventListener('click', () => {
            const message = game.messages.get(messageid);
            const linkedMessage = game.messages.get(message.flags.rockpaperscissors.linkedMessage);
            if (!linkedMessage.flags.rockpaperscissors.ready) {
                socket.executeAsGM("updateMessageRPS", message.id, { content: "You chose <strong>" + selectedChoice + "</strong>! Waiting for " + linkedMessage.user.name + " to make their choice...", flags: { rockpaperscissors: { ready: true, choice: selectedChoice } } });
            }
            else {
                const linkedMessageChoice = linkedMessage.flags.rockpaperscissors.choice;
                const messageChoice = selectedChoice
                const cardTitle = message.user.name + " and " + linkedMessage.user.name + " played Rifle, Pistol, Shotgun!";
                let result = message.user.name + " played <strong>" + messageChoice + "</strong>!<br><br>" + linkedMessage.user.name + " played <strong>" + linkedMessageChoice + "</strong>!<br><hr />";
                if (messageChoice === linkedMessageChoice) {
                    result += "<strong>It's a tie!</strong>";
                }
                else if ((messageChoice === "rifle" && linkedMessageChoice === "shotgun") || (messageChoice === "shotgun" && linkedMessageChoice === "pistol") || (messageChoice === "pistol" && linkedMessageChoice === "rifle")) {
                    result += "<strong>" + message.user.name + " won! </strong>";
                }
                else {
                    result += "<strong>" + linkedMessage.user.name + " won! </strong>";
                }
                ChatMessage.create({ speaker: { alias: "Rifle, Pistol, Shotgun!" }, content: `<div style="text-align: center;" class="chat-card"><header class="card-header flexrow"><h3>` + cardTitle + `</h3></header><section class="card-content">` + result + `</section></div>` })
                socket.executeAsGM("deleteMessageRPS", message.id);
                socket.executeAsGM("deleteMessageRPS", linkedMessage.id);
            }
        })
    }
}


function deleteMessageRPS(messageid) {
    const message = game.messages.get(messageid);
    message.delete();
}

function startRPS(message) {
    const activeUsers = game.users.filter(user => user.active && user.id !== message.user.id);
    if (activeUsers.length === 0) {
        ChatMessage.create({ speaker: { alias: "Rifle, Pistol, Shotgun!" }, content: "No other active users found.", whisper: [message.user.id] });
        return;
    }
    const dropdownOptions = activeUsers.map(user => ({
        label: user.name,
        value: user.id
    }));
    const dropdownHtml = `<select id="rpsSelectUser">
      ${dropdownOptions.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
    </select>`;
    const startButtonHtml = `<button class="rpsStartButton">Start</button>`;
    const contentHtml = `
    <div style="text-align: center;">
        Select a user to play Rifle, Pistol, Shotgun!
        <p>
            <div style="margin: 0 auto; display: inline-block;">
                ${dropdownHtml}
            </div>
        </p>
        <div>${startButtonHtml}</div>
    </div>
    `;
    ChatMessage.create({ speaker: { alias: "Rifle, Pistol, Shotgun!" }, content: contentHtml, whisper: [message.user.id] });
}

async function otherUserRPS(userid, message) {
    const initiatorsName = game.users.get(message.user).name;
    Hooks.once("createChatMessage", (msg) => {
        socket.executeAsGM("updateMessageRPS", message._id, { content: "You're playing Rifle, Pistol, Shotgun with <strong>" + msg.user.name + "</strong>!\nMake your choice and click \"<strong>Shoot!</strong>\"\n" + game.messages.get(message._id).content, flags: { rockpaperscissors: { linkedMessage: msg.id, ready: false } } });
    });
    await ChatMessage.create({ speaker: { alias: "Rifle, Pistol, Shotgun!" }, content: "<strong>" + initiatorsName + "</strong> wants to play Rifle, Pistol, Shotgun with you!\nMake your choice and click \"<strong>Shoot!</strong>\"\n" + generateRPSButtons(250), whisper: [userid], flags: { rockpaperscissors: { linkedMessage: message._id, ready: false } } });
}

function generateRPSButtons(width) {
    const buttonSize = `${(width * 0.3)}px`;

    const buttonStyle = `width: ${buttonSize}; height: ${buttonSize}; background-size: contain; background-repeat: no-repeat;`;

    const buttonsContainerStyle = `
                    display: flex;
                    justify-content: center; /* Center horizontally */
                `;

    const rifleButton = `<button class="rpsButton" data-choice="Rifle" style="${buttonStyle} background-image: url(modules/rockpaperscissors/vectors/Rifle.png);"></button>`;
    const pistolButton = `<button class="rpsButton" data-choice="Pistol" style="${buttonStyle} background-image: url(modules/rockpaperscissors/vectors/Pistol.png);"></button>`;
    const shotgunButton = `<button class="rpsButton" data-choice="Shotgun" style="${buttonStyle} background-image: url(modules/rockpaperscissors/vectors/Shotgun.png);"></button>`;
    const shootButtonHtml = `<div><button class="rpsShootButton"><strong>Shoot!</strong></button></div>`;
    return `<div style="${buttonsContainerStyle}">${rifleButton}${pistolButton}${shotgunButton}</div>${shootButtonHtml}`;
}

function updateMessageRPS(messageid, updateObject) {
    const message = game.messages.get(messageid);
    message.update(updateObject);
}
