// 斗罗大陆H5游戏链接生成器 - Web版
class URLGeneratorApp {
    constructor() {
        this.config = this.loadConfig();
        this.history = this.loadHistory();
        this.expiryTimestamp = 0;
        this.linkActive = false;
        this.currentSearch = "";
        
        this.init();
    }
    
    init() {
        this.updateUIFromConfig();
        this.updateTimeRemaining();
        this.updateCurrentTime();
        
        // 设置定时器
        setInterval(() => this.updateTimeRemaining(), 1000);
        setInterval(() => this.updateCurrentTime(), 1000);
        
        // 初始化历史记录下拉框
        this.updateHistorySelect();
        
        // 绑定事件
        this.bindEvents();
        
        this.logMessage("Web版链接生成器初始化完成");
    }
    
    bindEvents() {
        // 历史记录选择事件
        document.getElementById('historySelect').addEventListener('change', (e) => {
            this.onHistorySelected(e.target.value);
        });
        
        // 输入框变化时自动保存
        const inputs = ['baseUrl', 'appVer', 'platCode', 'IMEI', 'isPcLauncher'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.autoSaveConfig();
            });
        });
    }
    
    // ============ 配置管理 ============
    loadConfig() {
        try {
            const saved = localStorage.getItem('game_url_generator_config');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('加载配置失败:', e);
        }
        
        // 默认配置
        return {
            base_url: "https://xinwan.xinwanwl.com/login.php?",
            appVer: "",
            platCode: "37wan",
            IMEI: "",
            isPcLauncher: "true"
        };
    }
    
    saveConfig() {
        try {
            const config = {
                base_url: document.getElementById('baseUrl').value,
                appVer: document.getElementById('appVer').value,
                platCode: document.getElementById('platCode').value,
                IMEI: document.getElementById('IMEI').value,
                isPcLauncher: document.getElementById('isPcLauncher').value
            };
            
            localStorage.setItem('game_url_generator_config', JSON.stringify(config));
            this.config = config;
            this.logMessage("配置已保存");
            
            // 添加到历史记录
            this.addToHistory(config.base_url);
            
        } catch (e) {
            this.logMessage("保存配置失败: " + e.message, 'error');
        }
    }
    
    autoSaveConfig() {
        // 防抖保存，避免频繁操作
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveConfig();
        }, 1000);
    }
    
    // ============ 历史记录管理 ============
    loadHistory() {
        try {
            const saved = localStorage.getItem('base_url_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }
    
    addToHistory(url) {
        if (!url || url.trim() === '') return;
        
        // 移除重复项
        this.history = this.history.filter(item => item !== url);
        
        // 添加到开头
        this.history.unshift(url);
        
        // 限制历史记录数量
        if (this.history.length > 20) {
            this.history = this.history.slice(0, 20);
        }
        
        localStorage.setItem('base_url_history', JSON.stringify(this.history));
        this.updateHistorySelect();
    }
    
    updateHistorySelect() {
        const select = document.getElementById('historySelect');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">选择历史记录</option>';
        this.history.forEach(url => {
            const option = document.createElement('option');
            option.value = url;
            option.textContent = this.truncateUrl(url, 40);
            select.appendChild(option);
        });
        
        // 恢复之前的选择
        if (currentValue) {
            select.value = currentValue;
        }
    }
    
    onHistorySelected(url) {
        if (url) {
            document.getElementById('baseUrl').value = url;
            this.saveConfig();
            this.logMessage("已选择历史记录: " + this.truncateUrl(url, 50));
        }
    }
    
    clearHistory() {
        if (confirm('确定要清除所有历史记录吗？')) {
            this.history = [];
            localStorage.removeItem('base_url_history');
            this.updateHistorySelect();
            this.logMessage("历史记录已清除");
        }
    }
    
    // ============ URL解析和生成 ============
    parseRequest() {
        const input = document.getElementById('captureInput').value.trim();
        if (!input) {
            this.logMessage("请输入抓包请求内容", 'warning');
            return;
        }
        
        try {
            let params = {};
            
            // 判断输入类型并解析（与原始Python文件保持一致）
            if (input.includes('HTTP/1.1') || input.includes('HTTP/1.0') || input.includes('GET ') || input.includes('POST ')) {
                // HTTP请求格式（与原始Python文件处理方式一致）
                params = this.parseHttpRequest(input);
            } else if (input.includes('?')) {
                // URL格式
                const url = new URL(input);
                params = Object.fromEntries(url.searchParams);
            } else if (input.startsWith('{') && input.endsWith('}')) {
                // JSON格式
                params = JSON.parse(input);
            } else {
                // 尝试解析为查询字符串
                const searchParams = new URLSearchParams(input);
                params = Object.fromEntries(searchParams);
            }
            
            // 更新账号信息显示
            this.updateAccountInfo(params);
            
            // 生成完整URL
            this.generateFullUrl(params);
            
            this.logMessage("请求解析成功");
            
        } catch (error) {
            this.logMessage("解析失败: " + error.message, 'error');
        }
    }
    
    // 解析HTTP请求（与原始Python文件保持一致）
    parseHttpRequest(requestText) {
        const lines = requestText.split('\n');
        const params = {};
        
        // 解析请求行
        const requestLine = lines[0].trim();
        if (requestLine.includes('?')) {
            const urlParts = requestLine.split('?');
            const queryString = urlParts[1].split(' ')[0];
            const searchParams = new URLSearchParams(queryString);
            Object.assign(params, Object.fromEntries(searchParams));
        }
        
        // 查找请求体
        let hasBody = false;
        let requestBody = '';
        let contentLength = 0;
        let contentType = '';
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') {
                hasBody = true;
                if (i + 1 < lines.length) {
                    requestBody = lines.slice(i + 1).join('\n');
                }
                break;
            } else if (line.toLowerCase().startsWith('content-length:')) {
                contentLength = parseInt(line.split(':')[1].trim());
            } else if (line.toLowerCase().startsWith('content-type:')) {
                contentType = line.split(':')[1].trim().split(';')[0].trim();
            }
        }
        
        // 解析请求体
        if (hasBody && requestBody) {
            if (contentType === 'application/json') {
                try {
                    const jsonData = JSON.parse(requestBody);
                    for (const [key, value] of Object.entries(jsonData)) {
                        params[key] = Array.isArray(value) ? value.map(v => v.toString()) : [value.toString()];
                    }
                } catch (error) {
                    // 如果JSON解析失败，尝试解析为查询字符串
                    try {
                        const bodyParams = new URLSearchParams(requestBody);
                        Object.assign(params, Object.fromEntries(bodyParams));
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            } else {
                try {
                    const bodyParams = new URLSearchParams(requestBody);
                    Object.assign(params, Object.fromEntries(bodyParams));
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
        
        return params;
    }
    
    updateAccountInfo(params) {
        // 更新账号信息显示（与原始Python文件保持一致）
        const drname = params.drname ? decodeURIComponent(params.drname) : "未解析";
        const dsname = params.dsname ? decodeURIComponent(params.dsname) : "未解析";
        const dpname = params.dpname ? decodeURIComponent(params.dpname) : "未解析";
        
        document.getElementById('drnameDisplay').textContent = drname || "未解析";
        document.getElementById('dsnameDisplay').textContent = dsname || "未解析";
        document.getElementById('dpnameDisplay').textContent = dpname || "未解析";
        
        // 计算过期时间（与原始Python文件保持一致：time参数 + 3天）
        if (params.time && !isNaN(params.time)) {
            this.calculateExpiryTime(params.time);
        } else {
            document.getElementById('expiryDisplay').textContent = "过期时间: 无时间戳";
            document.getElementById('timeRemaining').textContent = "剩余时间: --";
            document.getElementById('linkStatus').textContent = "链接状态: 未生成";
            this.expiryTimestamp = 0;
        }
    }
    
    // 计算过期时间（与原始Python文件保持一致）
    calculateExpiryTime(timeStr) {
        if (!timeStr || isNaN(timeStr)) {
            document.getElementById('expiryDisplay').textContent = "过期时间: 无时间戳";
            this.expiryTimestamp = 0;
            return;
        }
        
        try {
            // 解析时间戳（与原始Python文件一致：time参数 + 3天）
            const timestamp = parseInt(timeStr);
            this.expiryTimestamp = timestamp + (3 * 24 * 3600); // 3天后过期
            
            // 检查时间戳是否有效
            const currentTime = Math.floor(Date.now() / 1000);
            if (this.expiryTimestamp < currentTime) {
                document.getElementById('expiryDisplay').textContent = "过期时间: 已过期";
                document.getElementById('linkStatus').textContent = "链接状态: ⚠️ 已过期（请重新抓包更新）";
                this.expiryTimestamp = 0;
                return;
            }
            
            // 转换为可读格式
            const expiryTime = new Date(this.expiryTimestamp * 1000);
            document.getElementById('expiryDisplay').textContent = 
                `过期时间: ${expiryTime.toLocaleString('zh-CN')}`;
            
            // 启动实时更新
            this.startTimeRemainingUpdate();
            
        } catch (error) {
            document.getElementById('expiryDisplay').textContent = `过期时间: 计算失败 (${error.message})`;
            this.expiryTimestamp = 0;
        }
    }
    
    // 启动剩余时间实时更新（与原始Python文件保持一致）
    startTimeRemainingUpdate() {
        // 清除之前的定时器
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        // 立即更新一次
        this.updateTimeRemaining();
        
        // 每秒更新一次
        this.timeUpdateInterval = setInterval(() => {
            this.updateTimeRemaining();
        }, 1000);
    }
    
    // 更新剩余时间显示（与原始Python文件保持一致）
    updateTimeRemaining() {
        if (!this.expiryTimestamp) {
            document.getElementById('timeRemaining').textContent = "剩余时间: --";
            document.getElementById('linkStatus').textContent = "链接状态: 未生成";
            return;
        }
        
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingSeconds = this.expiryTimestamp - currentTime;
        
        if (remainingSeconds <= 0) {
            document.getElementById('timeRemaining').textContent = "剩余时间: 已过期";
            document.getElementById('linkStatus').textContent = "链接状态: ⚠️ 已过期（请重新抓包更新）";
            
            // 清除定时器
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval);
                this.timeUpdateInterval = null;
            }
            return;
        }
        
        // 计算天、时、分、秒（与原始Python文件格式一致）
        const days = Math.floor(remainingSeconds / (24 * 3600));
        const hours = Math.floor((remainingSeconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;
        
        // 格式化显示（与原始Python文件一致）
        let timeRemainingText = "剩余时间: ";
        if (days > 0) {
            timeRemainingText += `${days}天 `;
        }
        timeRemainingText += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timeRemaining').textContent = timeRemainingText;
        
        // 更新链接状态（与原始Python文件一致）
        if (days >= 1) {
            document.getElementById('linkStatus').textContent = "链接状态: ✅ 有效";
        } else {
            document.getElementById('linkStatus').textContent = "链接状态: ⚠️ 即将过期";
        }
    }
    
    generateFullUrl(params) {
        const baseUrl = document.getElementById('baseUrl').value;
        if (!baseUrl) {
            this.logMessage("请先设置基础URL", 'warning');
            return;
        }
        
        try {
            // 提取目标参数（与原始Python文件保持一致）
            const targetParams = {
                gid: params.gid || "",
                pid: params.pid || "",
                token: params.token || "",
                time: params.time || "",
                sign: params.sign || ""
            };
            
            // 获取固定参数
            const fixedParams = {
                appVer: document.getElementById('appVer').value,
                platCode: document.getElementById('platCode').value,
                IMEI: document.getElementById('IMEI').value,
                isPcLauncher: document.getElementById('isPcLauncher').value
            };
            
            // 严格按照原始Python文件的顺序构建参数
            const orderedParams = [
                ["gid", targetParams.gid],
                ["pid", targetParams.pid],
                ["token", targetParams.token],
                ["time", targetParams.time],
                ["sign", targetParams.sign],
                ["appVer", fixedParams.appVer],
                ["platCode", fixedParams.platCode],
                ["IMEI", fixedParams.IMEI],
                ["isPcLauncher", fixedParams.isPcLauncher]
            ];
            
            // 构建查询字符串（保持严格顺序）
            const queryParts = [];
            for (const [key, value] of orderedParams) {
                if (value && value.toString().trim() !== '') {
                    // 对参数值进行URL编码（与原始Python文件保持一致）
                    const encodedValue = encodeURIComponent(value.toString().trim());
                    queryParts.push(`${key}=${encodedValue}`);
                }
            }
            
            const queryString = queryParts.join('&');
            
            // 清理基础URL中的查询参数（与原始Python文件保持一致）
            let cleanBaseUrl = baseUrl;
            try {
                const urlObj = new URL(baseUrl);
                cleanBaseUrl = `${urlObj.origin}${urlObj.pathname}`;
            } catch (error) {
                // 如果URL格式不正确，直接使用原始URL
                if (!baseUrl.startsWith('http')) {
                    cleanBaseUrl = 'https://' + baseUrl;
                }
            }
            
            const fullUrl = cleanBaseUrl + (queryString ? '?' + queryString : '');
            
            // 显示结果
            document.getElementById('resultOutput').textContent = fullUrl;
            document.getElementById('linkStatus').textContent = "链接状态: 已生成";
            
            this.linkActive = true;
            this.currentUrl = fullUrl;
            
            this.logMessage("URL生成成功");
            
        } catch (error) {
            this.logMessage("URL生成失败: " + error.message, 'error');
        }
    }
    
    // ============ UI更新方法 ============
    updateUIFromConfig() {
        document.getElementById('baseUrl').value = this.config.base_url || '';
        document.getElementById('appVer').value = this.config.appVer || '';
        document.getElementById('platCode').value = this.config.platCode || '37wan';
        document.getElementById('IMEI').value = this.config.IMEI || '';
        document.getElementById('isPcLauncher').value = this.config.isPcLauncher || 'true';
    }
    
    // updateTimeRemaining方法已在前面定义，删除重复定义
    
    updateCurrentTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = 
            now.toLocaleString('zh-CN');
    }
    
    // ============ 工具方法 ============
    copyUrl() {
        if (!this.currentUrl) {
            this.logMessage("请先生成链接", 'warning');
            return;
        }
        
        navigator.clipboard.writeText(this.currentUrl).then(() => {
            this.logMessage("链接已复制到剪贴板");
        }).catch(err => {
            // 备用方案
            const textArea = document.createElement('textarea');
            textArea.value = this.currentUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.logMessage("链接已复制到剪贴板");
        });
    }
    
    openUrl() {
        if (!this.currentUrl) {
            this.logMessage("请先生成链接", 'warning');
            return;
        }
        
        window.open(this.currentUrl, '_blank');
        this.logMessage("已在浏览器中打开链接");
    }
    
    logMessage(message, type = 'info') {
        const logArea = document.getElementById('logOutput');
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        
        let prefix = '[信息]';
        if (type === 'error') prefix = '[错误]';
        if (type === 'warning') prefix = '[警告]';
        
        const logEntry = document.createElement('div');
        logEntry.innerHTML = `<span style="color: ${this.getLogColor(type)}">${prefix} ${timestamp} ${message}</span>`;
        
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight;
    }
    
    getLogColor(type) {
        switch (type) {
            case 'error': return '#ff6b6b';
            case 'warning': return '#feca57';
            default: return '#00ff00';
        }
    }
    
    truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }
    
    clearAll() {
        if (confirm('确定要清空所有内容吗？')) {
            document.getElementById('captureInput').value = '';
            document.getElementById('resultOutput').textContent = '链接状态: 未生成';
            document.getElementById('linkStatus').textContent = '链接状态: 未生成';
            document.getElementById('timeRemaining').textContent = '剩余时间: --';
            
            // 重置账号信息
            document.getElementById('drnameDisplay').textContent = '未解析';
            document.getElementById('dsnameDisplay').textContent = '未解析';
            document.getElementById('dpnameDisplay').textContent = '未解析';
            document.getElementById('expiryDisplay').textContent = '未计算';
            
            this.currentUrl = null;
            this.linkActive = false;
            this.expiryTimestamp = 0;
            
            this.logMessage("所有内容已清空");
        }
    }
    
    clearLog() {
        document.getElementById('logOutput').innerHTML = 
            '[系统] 日志已清空<br>[系统] 当前时间: <span id="currentTime"></span>';
        this.updateCurrentTime();
    }
    
    resetApp() {
        if (confirm('确定要重置应用吗？这将清除所有配置和历史记录。')) {
            localStorage.clear();
            location.reload();
        }
    }
}

// 全局函数供HTML调用
function parseRequest() {
    app.parseRequest();
}

function copyUrl() {
    app.copyUrl();
}

function openUrl() {
    app.openUrl();
}

function saveConfig() {
    app.saveConfig();
}

function clearAll() {
    app.clearAll();
}

function clearLog() {
    app.clearLog();
}

function resetApp() {
    app.resetApp();
}

function clearHistory() {
    app.clearHistory();
}

function onHistorySelected(value) {
    app.onHistorySelected(value);
}

// 初始化应用
const app = new URLGeneratorApp();