(function() {
    'use strict';

    let socket = null;
    let hasLoggedDiagnostic = false; 
    let isTimerActive = false; // Simple flag to track UI state

    const createSpoolSVG = (index) => `
        <div id="cfs-spool-container-${index}" class="cfs-spool-container" style="flex: 1; text-align: center; max-width: 120px; min-width: 60px; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 8px; padding: 10px; position: relative; overflow: hidden;">
            
            <div id="cfs-reload-btn-${index}" class="cfs-single-reload-trigger" data-slot="${index}" style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.15); z-index: 10; transition: background 0.2s, border-color 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4);" title="Reload Spool ${index + 1}">
                <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #1ec8a5; transition: transform 0.3s;">
                    <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
                </svg>
            </div>

            <svg viewBox="0 0 248 500" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; position: relative; z-index: 2;">
                <defs>
                    <path id="cfs-oval" d="M0-63c35 0 63 28 63 63S35 63 0 63-63 35-63 0s28-63 63-63" vector-effect="non-scaling-stroke" />
                    <path id="cfs-center" d="M0-63c35 0 63 28 63 63S35 63 0 63h-624V-63z" vector-effect="non-scaling-stroke" />
                    <filter id="cfs-blur_wheel" width="1.3" height="1.16">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                        <feOffset dx="18" dy="0" result="oBlur" />
                        <feFlood flood-color="#000" flood-opacity=".67" />
                        <feComposite in2="oBlur" operator="in" />
                        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <g transform="matrix(0.59,0,0,3.95,197,250)">
                    <use href="#cfs-oval" style="filter: url(#cfs-blur_wheel)" fill="#AD8762" />
                    <use href="#cfs-oval" transform="scale(0.41)" style="filter: url(#cfs-blur_wheel)" fill="#AD8762" />
                    <use href="#cfs-center" transform="scale(0.41)" fill="#AD8762" />
                </g>
                <path id="cfs-filament-${index}" d="M0-63c35 0 63 28 63 63S35 63 0 63h-424V-63z" 
                    vector-effect="non-scaling-stroke" fill="#292929" 
                    transform="matrix(0.4,0,0,3.5,197,250)" style="display: none;" />
                <g transform="matrix(0.59,0,0,3.95,37,250)">
                    <use href="#cfs-oval" style="filter: url(#cfs-blur_wheel)" fill="#AD8762" />
                    <use href="#cfs-oval" transform="scale(0.41)" style="fill: #111111" />
                </g>
                <g id="cfs-text-group-${index}" style="display: none;">
                    <text id="cfs-percent-${index}" x="124" y="250" text-anchor="middle" font-weight="900" font-size="58px" fill="white" stroke="#000" stroke-width="6" stroke-linejoin="round" paint-order="stroke fill" style="text-shadow: 4px 4px 4px rgba(0,0,0,1); font-family: sans-serif;">0%</text>
                    <text id="cfs-weight-${index}" x="124" y="305" text-anchor="middle" font-weight="700" font-size="32px" fill="#b3e5fc" stroke="#000" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill" style="text-shadow: 2px 2px 4px rgba(0,0,0,1); font-family: sans-serif;">~0g</text>
                </g>
            </svg>
            <span id="cfs-material-${index}" style="margin-top: 10px; display: inline-block; font-size: 13px; font-weight: bold; padding: 2px 6px; border-radius: 15px; background: #333; color: #555; border: 1px solid #444; width: 100%; box-sizing: border-box; text-align: center; white-space: nowrap; overflow: hidden;">EMPTY</span>
        </div>
    `;

    function triggerSingleSpoolReload(e) {
        e.stopPropagation();
        const slotIndex = parseInt(this.getAttribute('data-slot'), 10);
        if (isNaN(slotIndex)) return;

        const svgIcon = this.querySelector('svg');
        if (svgIcon) {
            svgIcon.style.transform = 'rotate(360deg)';
            svgIcon.style.transition = 'transform 0.6s ease-in-out';
            setTimeout(() => { svgIcon.style.transform = 'none'; svgIcon.style.transition = 'none'; }, 600);
        }

        const bitmask = 1 << slotIndex;
        sendGcode(`BOX_INFO_REFRESH ADDR=1 NUM=${bitmask}`);
    }

    function sendGcode(gcode) {
        return fetch('/printer/gcode/script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: gcode })
        }).catch(err => console.error("[CFS Panel] Gcode failure:", err));
    }

    function toggleSmartSocket() {
        const btn = document.getElementById('cfs-power-btn');
        if (!btn) return;

        const isCurrentlyOn = btn.getAttribute('data-state') === 'on';

        if (isCurrentlyOn) {
            fetch(`/machine/device_power/device?device=cfs_dryer&action=off`, { method: 'POST' })
            .then(() => {
                sendGcode('CANCEL_DRYER_TIMER');
                isTimerActive = false;
                updatePowerButtonUI('off');
                const selectEl = document.getElementById('cfs-timer-select');
                if (selectEl) selectEl.value = "0";
            });
        } else {
            const selectEl = document.getElementById('cfs-timer-select');
            const minutes = parseInt(selectEl ? selectEl.value : "0", 10);

            if (minutes > 0) {
                sendGcode(`START_DRYER_TIMER MINUTES=${minutes}`);
                isTimerActive = true;
            } else {
                fetch(`/machine/device_power/device?device=cfs_dryer&action=on`, { method: 'POST' });
                isTimerActive = false;
            }
            updatePowerButtonUI('on');
        }
    }

    function handleTimerDropdownChange() {
        const minutes = parseInt(this.value, 10);
        const btn = document.getElementById('cfs-power-btn');
        const isCurrentlyOn = btn && btn.getAttribute('data-state') === 'on';

        if (minutes > 0) {
            sendGcode(`START_DRYER_TIMER MINUTES=${minutes}`);
            isTimerActive = true;
            updatePowerButtonUI('on');
        } else {
            sendGcode('CANCEL_DRYER_TIMER');
            isTimerActive = false;
            updatePowerButtonUI(isCurrentlyOn ? 'on' : 'off');
        }
    }

    function updatePowerButtonUI(state) {
        const btn = document.getElementById('cfs-power-btn');
        const btnText = document.getElementById('cfs-power-btn-text');
        if (!btn) return;

        btn.setAttribute('data-state', state);

        if (state === 'on') {
            btn.style.color = '#00e676';
            btn.style.borderColor = 'rgba(0, 230, 118, 0.4)';
            btn.style.background = 'rgba(0, 230, 118, 0.1)';
            if (btnText) {
                btnText.textContent = isTimerActive ? "DRYER ON [TIMER]" : "DRYER POWER";
            }
        } else {
            btn.style.color = '#ff1744';
            btn.style.borderColor = 'rgba(255, 23, 68, 0.3)';
            btn.style.background = 'transparent';
            if (btnText) btnText.textContent = "DRYER POWER";
        }
    }

    function updateSocketStateFromServer() {
        fetch('/machine/device_power/devices')
            .then(res => res.json())
            .then(data => {
                const device = data?.result?.find(d => d.device === 'cfs_dryer');
                if (device) {
                    if (device.status === 'off') {
                        isTimerActive = false;
                        const selectEl = document.getElementById('cfs-timer-select');
                        if (selectEl) selectEl.value = "0";
                    }
                    updatePowerButtonUI(device.status);
                }
            })
            .catch(() => {});
    }

    function findTargetColumn() {
        const selectors = [
            '.v-window-item--active .row > .col-md-6',
            '.v-window-item--active .row > .col-12',
            '.v-window-item--active .row > [class*="col-"]',
            '.dashboard-page .row > div',
            '.v-main__wrap .container .row > [class*="col-"]',
            '#app .v-main__wrap .container .row > div',
            '.v-main .container .row > div',
            'main .container .row > div'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                // Ensure the matched element is NOT a child/descendant of any standard panel or v-card
                if (el && !el.closest('.v-card') && !el.closest('.panel') && !el.closest('.v-dialog') && el.offsetParent !== null) {
                    return el;
                }
            }
        }
        return null;
    }

    function buildCfsCard() {
        try {
            if (document.getElementById('mainsail-cfs-panel')) return;

            const targetColumn = findTargetColumn();
            if (!targetColumn) {
                if (!hasLoggedDiagnostic) {
                    console.warn("[CFS Panel] Active dashboard column not found yet. Retrying...");
                    hasLoggedDiagnostic = true;
                }
                return;
            }

            console.log("[CFS Panel] Injecting panel into target element:", targetColumn);
            hasLoggedDiagnostic = false; 

            const card = document.createElement('div');
            card.id = 'mainsail-cfs-panel';
            card.className = 'v-card v-sheet theme--dark mb-4 elevation-2';
            card.style.border = '1px solid rgba(255, 255, 255, 0.12)';

            card.innerHTML = `
                <div class="v-toolbar v-toolbar--flat v-sheet theme--dark" style="height: 44px; background: transparent;">
                    <div class="v-toolbar__content" style="height: 44px; padding: 0 16px; display: flex; align-items: center;">
                        <i class="v-icon notranslate mdi mdi-layers-outline theme--dark primary--text mr-2" style="font-size: 20px;"></i>
                        <div class="v-toolbar__title text-h6 font-weight-regular" style="font-size: 1.1rem !important; margin-right: 12px; display: inline-block;">CFS Status</div>
                        <div class="spacer"></div>
                        
                        <!-- Modular Power & Timer Selection Area -->
                        <div style="display: flex; align-items: center; gap: 4px; margin-right: 12px;">
                            <button id="cfs-power-btn" data-state="off" style="font-size: 11px; font-weight: bold; padding: 2px 10px; border-radius: 4px 0 0 4px; border: 1px solid rgba(255,255,255,0.15); border-right: none; color: #aaa; background: transparent; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; height: 24px;" title="Toggle Socket Power">
                                <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: currentColor;"><path d="M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M12,19A7,7 0 0,1 5,12A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19M12,7A2,2 0 0,0 10,9V15A2,2 0 0,0 12,17A2,2 0 0,0 14,15V9A2,2 0 0,0 12,7Z"/></svg>
                                <span id="cfs-power-btn-text">DRYER POWER</span>
                            </button>
                            <select id="cfs-timer-select" style="font-size: 10px; font-weight: bold; padding: 0 4px; border-radius: 0 4px 4px 0; border: 1px solid rgba(255,255,255,0.15); color: #ccc; background: #262626; cursor: pointer; height: 24px; outline: none; text-align-last: center;" title="Shutdown Timer">
                                <option value="0">∞ No Timer</option>
                                <option value="30">30 Mins</option>
                                <option value="60">1 Hour</option>
                                <option value="120">2 Hours</option>
                                <option value="240">4 Hours</option>
                                <option value="480">8 Hours</option>
                                <option value="720">12 Hours</option>
                            </select>
                        </div>

                        <span id="cfs-connection-chip" class="v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small error--text font-weight-bold" style="padding: 0 8px;">
                            CFS DAEMON: DISCONNECTED
                        </span>
                    </div>
                </div>
                <div class="v-card__text pa-2" style="padding: 8px !important;">
                    <style>
                        @keyframes cfsPulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                        .cfs-active-spool-bg { background: linear-gradient(to top, rgba(0, 230, 118, 0.15) 0%, transparent 100%) !important; border-bottom: 3px solid #00e676 !important; }
                        .cfs-empty-spool { filter: grayscale(1) opacity(0.3); }
                        .cfs-transit-pulse { animation: cfsPulse 1.5s infinite ease-in-out; border-color: #ffb300 !important; color: #ffb300 !important; background: rgba(255,179,0,0.1) !important; }
                        .cfs-single-reload-trigger:hover { background: rgba(30, 200, 165, 0.4) !important; border-color: #1ec8a5 !important; }
                    </style>
                    <div id="cfs-spool-grid" style="display: flex; justify-content: space-around; background: #1a1a1a; padding: 10px; border-radius: 12px; border: 1px solid #333; gap: 8px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                        ${[0,1,2,3].map(i => createSpoolSVG(i)).join('')}
                    </div>
                    <div id="cfs-climate-info" style="margin-top: 12px; display: flex; justify-content: center; align-items: center; gap: 15px; padding-bottom: 4px;">
                        <span id="cfs-temp-val" style="color: #eee; font-weight: bold;">--°C</span>
                        <span style="font-weight: 100; color: #666;">/</span>
                        <span id="cfs-hum-val" style="color: #eee; font-weight: bold; padding: 2px 6px; border-radius: 4px; transition: all 0.3s;">--%</span>
                        <span id="cfs-status-chip" class="v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small grey--text font-weight-bold" style="margin-left: 10px; padding: 0 8px;">IDLE</span>
                    </div>
                </div>
            `;

            targetColumn.insertBefore(card, targetColumn.firstChild);
            
            for (let i = 0; i < 4; i++) {
                const btn = document.getElementById(`cfs-reload-btn-${i}`);
                if (btn) btn.addEventListener('click', triggerSingleSpoolReload);
            }

            const powerBtn = document.getElementById('cfs-power-btn');
            if (powerBtn) powerBtn.addEventListener('click', toggleSmartSocket);

            const timerSelect = document.getElementById('cfs-timer-select');
            if (timerSelect) timerSelect.addEventListener('change', handleTimerDropdownChange);
            
            updateSocketStateFromServer();

            if (socket && socket.readyState === 1) { 
                const connectionChip = document.getElementById('cfs-connection-chip');
                if (connectionChip) {
                    connectionChip.textContent = 'CFS DAEMON: CONNECTED';
                    connectionChip.className = "v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small success--text font-weight-bold";
                }
                try {
                    socket.send(JSON.stringify({"method":"get","params":{"boxsInfo":1}}));
                } catch(sendError) {}
            } else {
                connectCfsWebSocket();
            }
        } catch (domError) {
            console.error("[CFS Panel] Error constructing CFS panel DOM elements:", domError);
        }
    }

    function updateCfsUI(materialBoxsArray) {
        try {
            const box1 = materialBoxsArray.find(b => b.id === 1);
            if (!box1?.materials) return;

            box1.materials.forEach((mat, index) => {
                if (index > 3) return;
                
                const container = document.getElementById(`cfs-spool-container-${index}`);
                const filEl = document.getElementById(`cfs-filament-${index}`);
                const textGroupEl = document.getElementById(`cfs-text-group-${index}`);
                const percentEl = document.getElementById(`cfs-percent-${index}`);
                const weightEl = document.getElementById(`cfs-weight-${index}`);
                const materialEl = document.getElementById(`cfs-material-${index}`);
                if (!container) return;
                
                const state = mat.state ?? 0;
                const hasMaterial = state !== 0;
                const isSelected = mat.selected === 1;

                materialEl.classList.remove('cfs-transit-pulse');

                if (hasMaterial) {
                    container.classList.remove('cfs-empty-spool');
                    textGroupEl.style.display = 'block';
                    
                    const currentPercent = mat.percent ?? 0;
                    percentEl.textContent = `${currentPercent}%`;
                    weightEl.textContent = `~${currentPercent * 10}g`;
                    
                    materialEl.style.color = '#aaa';
                    
                    if (state === 3) {
                        materialEl.textContent = "FEEDING...";
                        materialEl.classList.add('cfs-transit-pulse');
                    } else if (state === 4) {
                        materialEl.textContent = "RETRACTING...";
                        materialEl.classList.add('cfs-transit-pulse');
                    } else {
                        materialEl.textContent = mat.type || 'UNKNOWN';
                    }
                } else {
                    container.classList.add('cfs-empty-spool');
                    textGroupEl.style.display = 'none';
                    materialEl.style.color = '#555';
                    materialEl.textContent = "EMPTY";
                }

                if (isSelected && state !== 0 && state !== 4) {
                    container.classList.add('cfs-active-spool-bg');
                    if (state !== 3) {
                        materialEl.style.borderColor = '#00e676';
                        materialEl.style.color = '#00e676';
                    }
                } else {
                    container.classList.remove('cfs-active-spool-bg');
                    if (state !== 3 && state !== 4) {
                        materialEl.style.borderColor = '#444';
                    }
                }

                if (filEl && hasMaterial) {
                    filEl.style.display = 'block';
                    const percent = mat.percent || 0;
                    const sX = 0.28 + (0.4 - 0.28) * (percent / 100);
                    const sY = 1.65 + (3.5 - 1.65) * (percent / 100);
                    filEl.setAttribute('transform', `matrix(${sX},0,0,${sY},197,250)`);
                    
                    let cleanColor = mat.color || "#444444";
                    if (cleanColor.startsWith("#0") && cleanColor.length > 7) cleanColor = "#" + cleanColor.substring(2);
                    filEl.setAttribute('fill', cleanColor);
                } else if (filEl) {
                    filEl.style.display = 'none';
                }
            });

            const humVal = box1.humidity ?? 0;
            const humEl = document.getElementById('cfs-hum-val');
            
            document.getElementById('cfs-temp-val').textContent = `${box1.temp || "--"}°C`;
            humEl.textContent = humVal !== '--' ? `${humVal}%` : '--%';
            
            if (typeof humVal === 'number') {
                if (humVal < 40) {
                    humEl.style.background = 'rgba(0, 230, 118, 0.15)';
                    humEl.style.color = '#00e676';
                } else if (humVal >= 40 && humVal < 60) {
                    humEl.style.background = 'rgba(255, 179, 0, 0.15)';
                    humEl.style.color = '#ffb300';
                } else {
                    humEl.style.background = 'rgba(255, 23, 68, 0.15)';
                    humEl.style.color = '#ff1744';
                }
            }

            const statusChip = document.getElementById('cfs-status-chip');
            if (box1.state === 1) {
                statusChip.textContent = 'ONLINE';
                statusChip.className = "v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small success--text font-weight-bold";
            } else {
                statusChip.textContent = 'IDLE';
                statusChip.className = "v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small grey--text font-weight-bold";
            }
        } catch (uiError) {
            console.error("[CFS Panel] Error updating CFS UI components:", uiError);
        }
    }

    function connectCfsWebSocket() {
        if (socket && socket.readyState <= 1) return;
        try {
            const host = window.location.hostname || 'localhost';
            socket = new WebSocket(`ws://${host}:9999`);
            const connectionChip = document.getElementById('cfs-connection-chip');

            socket.onopen = () => {
                console.log("[CFS Panel] WebSocket connected successfully!");
                if (connectionChip) {
                    connectionChip.textContent = 'CFS DAEMON: CONNECTED';
                    connectionChip.className = "v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small success--text font-weight-bold";
                }
                try {
                    socket.send(JSON.stringify({"method":"get","params":{"boxsInfo":1}}));
                } catch(err) {}
            };

            socket.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data?.boxsInfo?.materialBoxs) updateCfsUI(data.boxsInfo.materialBoxs);
                } catch(err) {}
            };

            socket.onclose = () => {
                console.warn("[CFS Panel] WebSocket disconnected. Attempting reconnect...");
                if (connectionChip) {
                    connectionChip.textContent = 'CFS DAEMON: DISCONNECTED';
                    connectionChip.className = "v-chip v-chip--no-color v-chip--outlined theme--dark v-size--x-small error--text font-weight-bold";
                }
                setTimeout(connectCfsWebSocket, 5000);
            };

            socket.onerror = (err) => {
                console.error("[CFS Panel] WebSocket encountered an error:", err);
            };
        } catch (connectionError) {
            console.error("[CFS Panel] Could not construct WebSocket client instance:", connectionError);
        }
    }

    setInterval(buildCfsCard, 1000);
    setInterval(updateSocketStateFromServer, 4000);
})();
