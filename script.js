// 垃圾分类助手前端交互脚本 - 使用Gradio正确API
class GarbageDetectionApp {
    constructor() {
        this.currentInputType = 'image';
        this.selectedFile = null;
        this.webcamStream = null;
        this.isProcessing = false;
        
    // Flask API配置
    this.apiBase = 'http://127.0.0.1:7860';
        this.apiTimeout = 300000; // 增加超时时间到5分钟
        this.webcamInterval = null; // 摄像头检测间隔
        this.webcamDetectionDelay = 300; // 摄像头检测延迟（毫秒）
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.showNotification('欢迎使用智能垃圾分类助手！', 'info');
        
        // 检查Gradio服务是否可用
        await this.checkGradioService();
    }

    async checkGradioService() {
        try {
            const response = await fetch(`${this.apiBase}/health`, { method: 'GET' });
            if (response.ok) {
                console.log('✅ API服务连接成功');
                this.showNotification('API服务连接成功', 'success');
            } else {
                this.showNotification('⚠️ API服务未连接，请检查后端', 'warning');
            }
        } catch (error) {
            console.error('API服务连接失败:', error);
            this.showNotification('❌ 无法连接到API服务，请确保后端已启动', 'error');
        }
    }

    bindEvents() {
        // 输入类型切换
        document.querySelectorAll('input[name="inputType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchInputType(e.target.value);
            });
        });

        // 文件上传区域
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        fileUploadArea.addEventListener('click', () => {
            if (!this.isProcessing) {
                fileInput.click();
            }
        });

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            if (!this.isProcessing && e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // 滑块值更新
        document.getElementById('imageSize').addEventListener('input', (e) => {
            document.getElementById('imageSizeValue').textContent = e.target.value;
        });

        document.getElementById('confThreshold').addEventListener('input', (e) => {
            document.getElementById('confValue').textContent = e.target.value;
        });

        // 检测按钮
        document.getElementById('detectBtn').addEventListener('click', () => {
            this.startDetection();
        });

        // 摄像头按钮
        document.getElementById('webcamBtn').addEventListener('click', () => {
            this.toggleWebcam();
        });

        // 示例图片点击
        document.querySelectorAll('.example-item').forEach(item => {
            item.addEventListener('click', () => {
                const example = item.dataset.example;
                this.loadExample(example);
            });
        });
    }

    switchInputType(type) {
        this.currentInputType = type;
        
        const fileUploadArea = document.getElementById('fileUploadArea');
        const webcamGroup = document.getElementById('webcamGroup');
        const webcamBtn = document.getElementById('webcamBtn');
        const detectBtn = document.getElementById('detectBtn');

        // 重置状态
        this.resetFileUpload();
        this.stopWebcam();

        if (type === 'image') {
            fileUploadArea.style.display = 'block';
            fileUploadArea.querySelector('.upload-hint').textContent = '支持图片格式 (JPG, PNG, JPEG)';
            webcamGroup.style.display = 'none';
            webcamBtn.style.display = 'none';
            detectBtn.style.display = 'flex';
        } else if (type === 'video') {
            fileUploadArea.style.display = 'block';
            fileUploadArea.querySelector('.upload-hint').textContent = '支持视频格式 (MP4, AVI, MOV)';
            webcamGroup.style.display = 'none';
            webcamBtn.style.display = 'none';
            detectBtn.style.display = 'flex';
        } else if (type === 'webcam') {
            fileUploadArea.style.display = 'none';
            webcamGroup.style.display = 'block';
            webcamBtn.style.display = 'flex';
            detectBtn.style.display = 'none';
        }
    }

    handleFileSelect(file) {
        if (this.currentInputType === 'image' && !file.type.startsWith('image/')) {
            this.showNotification('请选择图片文件！', 'error');
            return;
        }

        if (this.currentInputType === 'video' && !file.type.startsWith('video/')) {
            this.showNotification('请选择视频文件！', 'error');
            return;
        }

        this.selectedFile = file;
        
        // 更新UI
        const fileUploadArea = document.getElementById('fileUploadArea');
        fileUploadArea.classList.add('has-file');
        fileUploadArea.querySelector('.upload-text').textContent = file.name;

        // 预览上传的文件
        this.previewUploadedFile(file);

        this.showNotification(`已选择文件: ${file.name}`, 'success');
    }

    previewUploadedFile(file) {
        // 在结果区域预览上传的文件
        const resultImage = document.getElementById('resultImage');
        const resultVideo = document.getElementById('resultVideo');
        const mediaPlaceholder = document.querySelector('.media-placeholder');

        // 隐藏占位符
        if (mediaPlaceholder) mediaPlaceholder.style.display = 'none';
        
        // 释放之前的URL
        if (this.previewVideoURL) {
            URL.revokeObjectURL(this.previewVideoURL);
            this.previewVideoURL = null;
        }

        if (this.currentInputType === 'image') {
            // 预览图片
            resultVideo.style.display = 'none';
            resultImage.style.display = 'block';
            
            const reader = new FileReader();
            reader.onload = (e) => {
                resultImage.src = e.target.result;
            };
            reader.onerror = () => {
                this.showNotification('图片预览失败', 'error');
            };
            reader.readAsDataURL(file);
        } else if (this.currentInputType === 'video') {
            // 预览视频
            resultImage.style.display = 'none';
            resultVideo.style.display = 'block';
            
            this.previewVideoURL = URL.createObjectURL(file);
            resultVideo.src = this.previewVideoURL;
            resultVideo.load();
        }
        
        // 重置检测结果文本
        document.getElementById('detectionResult').innerHTML = '<div class="result-placeholder">点击"开始垃圾分类"进行检测...</div>';
        document.getElementById('categorySummary').innerHTML = '<div class="result-placeholder">等待检测...</div>';
    }

    resetFileUpload() {
        this.selectedFile = null;
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        
        fileUploadArea.classList.remove('has-file');
        fileUploadArea.querySelector('.upload-text').textContent = '点击或拖拽文件到此处';
        fileInput.value = '';
        
        // 重置结果区域
        this.resetResults();
    }

    async toggleWebcam() {
        const webcamVideo = document.getElementById('webcamVideo');
        const webcamBtn = document.getElementById('webcamBtn');

        if (this.webcamStream) {
            // 停止摄像头和检测
            this.stopWebcam();
            webcamBtn.querySelector('.btn-text').textContent = '开启实时检测';
            this.showNotification('已停止实时检测', 'info');
        } else {
            try {
                // 启动摄像头
                this.webcamStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                webcamVideo.srcObject = this.webcamStream;
                
                // 等待视频加载
                await new Promise((resolve) => {
                    webcamVideo.onloadedmetadata = resolve;
                });
                
                webcamBtn.querySelector('.btn-text').textContent = '停止检测';
                this.showNotification('摄像头已启动，开始实时检测...', 'success');
                
                // 启动实时检测
                this.startRealTimeDetection();
            } catch (err) {
                console.error('摄像头启动失败:', err);
                this.showNotification('无法访问摄像头: ' + err.message, 'error');
            }
        }
    }

    startRealTimeDetection() {
        // 每200毫秒检测一次，大幅提高实时性
        this.realTimeDetectionInterval = setInterval(() => {
            if (this.webcamStream && !this.isProcessing) {
                this.detectFromWebcam();
            }
        }, 200);
    }

    stopRealTimeDetection() {
        if (this.realTimeDetectionInterval) {
            clearInterval(this.realTimeDetectionInterval);
            this.realTimeDetectionInterval = null;
        }
    }

    stopWebcam() {
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
            const webcamVideo = document.getElementById('webcamVideo');
            webcamVideo.srcObject = null;
        }
        this.stopRealTimeDetection();
    }

    async loadExample(exampleName) {
        this.showNotification(`加载示例: ${exampleName}`, 'info');
        setTimeout(() => {
            this.showNotification('请手动上传示例图片进行检测', 'info');
        }, 1000);
    }

    async startDetection() {
        if (this.isProcessing) {
            this.showNotification('正在处理中，请稍候...', 'warning');
            return;
        }

        if (this.currentInputType === 'webcam') {
            if (!this.webcamStream) {
                this.showNotification('请先开启摄像头', 'error');
                return;
            }
            await this.detectFromWebcam();
        } else {
            if (!this.selectedFile) {
                this.showNotification('请先选择文件', 'error');
                return;
            }
            await this.detectFromFile();
        }
    }

    async detectFromFile() {
        if (this.currentInputType === 'video') {
            this.setLoading(true, '正在处理视频，请稍候...（这可能需要几分钟）');
        } else {
            this.setLoading(true, '正在检测中...');
        }

        try {
            // 准备表单数据
            const formData = new FormData();
            
            if (this.currentInputType === 'image') {
                formData.append('image', this.selectedFile);
            } else if (this.currentInputType === 'video') {
                formData.append('video', this.selectedFile);
            }

            // 添加参数
            const modelId = document.getElementById('modelSelect').value;
            const imageSize = parseInt(document.getElementById('imageSize').value);
            const confThreshold = parseFloat(document.getElementById('confThreshold').value);
            
            formData.append('model_id', modelId);
            formData.append('image_size', imageSize);
            formData.append('conf_threshold', confThreshold);
            formData.append('input_type', this.currentInputType === 'image' ? 'Image' : 'Video');

            // 调用Flask API
            const predictUrl = `${this.apiBase}/predict`;
            
            // 使用AbortController来支持取消操作
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);
            
            const response = await fetch(predictUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.processResult(result);

        } catch (error) {
            console.error('检测失败:', error);
            if (error.name === 'AbortError') {
                this.showNotification('检测超时，请尝试使用更小的视频或调整参数', 'error');
            } else {
                this.showNotification('检测失败: ' + error.message, 'error');
            }
        } finally {
            this.setLoading(false);
        }
    }

    async detectFromWebcam() {
        // 实时检测不显示加载状态
        this.isProcessing = true;

        try {
            // 从摄像头捕获当前帧
            const video = document.getElementById('webcamVideo');
            
            // 确保视频已准备好
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                this.isProcessing = false;
                return;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 转换为Blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            
            if (!blob) {
                this.isProcessing = false;
                return;
            }
            
            // 准备表单数据
            const formData = new FormData();
            formData.append('image', blob, 'webcam.jpg');
            
            const modelId = document.getElementById('modelSelect').value;
            const imageSize = parseInt(document.getElementById('imageSize').value);
            const confThreshold = parseFloat(document.getElementById('confThreshold').value);
            
            formData.append('model_id', modelId);
            formData.append('image_size', imageSize);
            formData.append('conf_threshold', confThreshold);
            formData.append('input_type', 'Image');

            // 调用Flask API
            const predictUrl = `${this.apiBase}/predict`;
            const response = await fetch(predictUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                console.error('摄像头检测HTTP错误:', response.status);
                this.isProcessing = false;
                return;
            }

            const result = await response.json();
            
            // 处理结果并显示在右侧
            if (result && result.data && result.data.length >= 3) {
                const imageResult = result.data[0];
                const detectionText = result.data[1];
                const categorySummary = result.data[2];

                // 显示检测后的图片在右侧
                this.displayWebcamResult(imageResult, detectionText, categorySummary);
            }

        } catch (error) {
            console.error('摄像头检测失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    displayWebcamResult(imageData, detectionText, categorySummary) {
        // 在右侧显示摄像头检测结果
        const resultImage = document.getElementById('resultImage');
        const resultVideo = document.getElementById('resultVideo');
        const mediaPlaceholder = document.querySelector('.media-placeholder');

        // 隐藏占位符和视频，显示图片
        if (mediaPlaceholder) mediaPlaceholder.style.display = 'none';
        resultVideo.style.display = 'none';
        resultImage.style.display = 'block';

        // 显示检测结果图片
        if (imageData && imageData.image) {
            resultImage.src = `data:image/jpeg;base64,${imageData.image}`;
        }

        // 显示检测详情
        if (detectionText) {
            const detectionElement = document.getElementById('detectionResult');
            detectionElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.style.fontFamily = 'inherit';
            pre.textContent = detectionText;
            detectionElement.appendChild(pre);
        }

        // 显示类别统计
        if (categorySummary) {
            const summaryElement = document.getElementById('categorySummary');
            summaryElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.style.fontFamily = 'inherit';
            pre.textContent = categorySummary;
            summaryElement.appendChild(pre);
        }
    }

    processResult(result) {
        // 处理Gradio API返回的结果
        if (!result || !result.data) {
            this.showNotification('无效的返回数据', 'error');
            return;
        }

        const data = result.data;
        
        // 根据输入类型处理结果
        if (this.currentInputType === 'image') {
            // 图片检测结果
            if (data.length >= 3) {
                const imageResult = data[0]; // 图片数据
                const detectionText = data[1]; // 检测详情
                const categorySummary = data[2]; // 类别统计

                this.displayImageResult(imageResult, detectionText, categorySummary);
            }
        } else if (this.currentInputType === 'video') {
            // 视频检测结果 - 后端返回 [null, video_url, detection_text, category_summary]
            if (data.length >= 4) {
                const videoResult = data[1]; // 视频URL
                const detectionText = data[2]; // 检测详情
                const categorySummary = data[3]; // 类别统计

                this.displayVideoResult(videoResult, detectionText, categorySummary);
            } else {
                console.error('视频检测结果数据不完整:', data);
                this.showNotification('视频检测结果数据不完整', 'error');
            }
        } else if (this.currentInputType === 'webcam') {
            // 摄像头检测结果
            if (data.length >= 3) {
                const imageResult = data[0]; // 图片数据
                const detectionText = data[1]; // 检测详情
                const categorySummary = data[2]; // 类别统计

                this.displayImageResult(imageResult, detectionText, categorySummary);
            }
        }

        this.showNotification('检测完成！', 'success');
    }

    displayImageResult(imageData, detectionText, categorySummary, isRealTime = false) {
        // 显示结果图片
        const resultImage = document.getElementById('resultImage');
        const resultVideo = document.getElementById('resultVideo');
        const mediaPlaceholder = document.querySelector('.media-placeholder');

        // 隐藏占位符，显示图片
        if (mediaPlaceholder) mediaPlaceholder.style.display = 'none';
        resultVideo.style.display = 'none';
        resultImage.style.display = 'block';

        // 处理图片数据
        if (imageData && imageData.image) {
            // Gradio返回的图片数据通常是base64编码
            resultImage.src = `data:image/jpeg;base64,${imageData.image}`;
        } else if (typeof imageData === 'string') {
            // 或者直接是URL
            resultImage.src = imageData;
        }

        // 显示检测详情
        if (detectionText) {
            const detectionElement = document.getElementById('detectionResult');
            detectionElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.textContent = detectionText;
            detectionElement.appendChild(pre);
        }

        // 显示类别统计
        if (categorySummary) {
            const summaryElement = document.getElementById('categorySummary');
            summaryElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.textContent = categorySummary;
            summaryElement.appendChild(pre);
        }
    }

    displayVideoResult(videoData, detectionText, categorySummary) {
        // 显示结果视频
        const resultImage = document.getElementById('resultImage');
        const resultVideo = document.getElementById('resultVideo');
        const mediaPlaceholder = document.querySelector('.media-placeholder');

        // 隐藏占位符，显示视频
        if (mediaPlaceholder) mediaPlaceholder.style.display = 'none';
        resultImage.style.display = 'none';
        resultVideo.style.display = 'block';

        // 释放之前的预览URL
        if (this.previewVideoURL) {
            URL.revokeObjectURL(this.previewVideoURL);
            this.previewVideoURL = null;
        }

        // 处理视频数据 - 使用API服务器URL
        if (videoData && typeof videoData === 'string') {
            if (videoData.startsWith('/video/')) {
                // 通过API服务器获取视频
                resultVideo.src = `${this.apiBase}${videoData}`;
            } else if (videoData.startsWith('data:')) {
                // base64数据
                resultVideo.src = videoData;
            } else {
                resultVideo.src = videoData;
            }
        }

        // 显示检测详情
        if (detectionText) {
            const detectionElement = document.getElementById('detectionResult');
            detectionElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.style.fontFamily = 'inherit';
            pre.textContent = detectionText;
            detectionElement.appendChild(pre);
        }

        // 显示类别统计
        if (categorySummary) {
            const summaryElement = document.getElementById('categorySummary');
            summaryElement.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '0';
            pre.style.fontFamily = 'inherit';
            pre.textContent = categorySummary;
            summaryElement.appendChild(pre);
        }

        // 加载并播放视频
        resultVideo.load();
        resultVideo.play().catch(e => console.log('自动播放被浏览器阻止:', e));
    }

    resetResults() {
        // 重置结果展示区域
        const resultImage = document.getElementById('resultImage');
        const resultVideo = document.getElementById('resultVideo');
        const mediaPlaceholder = document.querySelector('.media-placeholder');
        const detectionResult = document.getElementById('detectionResult');
        const categorySummary = document.getElementById('categorySummary');

        resultImage.style.display = 'none';
        resultVideo.style.display = 'none';
        resultImage.src = '';
        resultVideo.src = '';
        
        if (mediaPlaceholder) mediaPlaceholder.style.display = 'flex';
        
        detectionResult.innerHTML = '<div class="result-placeholder">检测结果详情将显示在这里...</div>';
        categorySummary.innerHTML = '<div class="result-placeholder">统计信息将显示在这里...</div>';
    }

    setLoading(isLoading, message = '正在处理中...') {
        this.isProcessing = isLoading;
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay.querySelector('.loading-text');

        if (isLoading) {
            loadingText.textContent = message;
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = notification.querySelector('.notification-text');
        const notificationIcon = notification.querySelector('.notification-icon');

        // 设置内容
        notificationText.textContent = message;

        // 设置图标和样式
        switch (type) {
            case 'success':
                notificationIcon.textContent = '✅';
                break;
            case 'error':
                notificationIcon.textContent = '❌';
                break;
            case 'warning':
                notificationIcon.textContent = '⚠️';
                break;
            default:
                notificationIcon.textContent = 'ℹ️';
        }

        // 显示通知
        notification.classList.add('show');

        // 3秒后自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否在本地环境
    if (window.location.protocol === 'file:') {
        // 如果是本地文件，显示提示
        setTimeout(() => {
            const notification = document.getElementById('notification');
            if (notification) {
                const notificationText = notification.querySelector('.notification-text');
                notificationText.textContent = '请确保Gradio后端服务已启动，并在正确的端口运行';
                notification.classList.add('show');
                
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 5000);
            }
        }, 1000);
    }

    // 初始化应用
    window.app = new GarbageDetectionApp();
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('全局错误:', e.error);
    if (window.app) {
        window.app.showNotification('发生错误: ' + e.message, 'error');
    }
});

// 未捕获的Promise错误
window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的Promise错误:', e.reason);
    if (window.app) {
        window.app.showNotification('操作失败: ' + e.reason.message, 'error');
    }
});
