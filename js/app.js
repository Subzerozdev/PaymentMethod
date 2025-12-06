/**
 * Momo QR Payment Simulator
 * Tạo mã QR thanh toán Momo và mô phỏng kết quả thanh toán
 */

class MomoPayment {
    constructor() {
        this.qrCodeInstance = null;
        this.currentPayment = null;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.formatAmountInput();
    }

    bindElements() {
        // Form elements
        this.phoneInput = document.getElementById('phoneNumber');
        this.nameInput = document.getElementById('receiverName');
        this.amountInput = document.getElementById('amount');
        this.descriptionInput = document.getElementById('description');
        this.generateBtn = document.getElementById('generateQR');

        // Sections
        this.paymentForm = document.getElementById('paymentForm');
        this.qrSection = document.getElementById('qrSection');
        this.qrCodeContainer = document.getElementById('qrCode');

        // Display elements
        this.displayName = document.getElementById('displayName');
        this.displayPhone = document.getElementById('displayPhone');
        this.displayAmount = document.getElementById('displayAmount');
        this.displayDescription = document.getElementById('displayDescription');

        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');

        // Buttons
        this.btnSuccess = document.getElementById('btnSuccess');
        this.btnFailed = document.getElementById('btnFailed');
        this.newPaymentBtn = document.getElementById('newPayment');

        // Modals
        this.successModal = document.getElementById('successModal');
        this.failedModal = document.getElementById('failedModal');
        this.successAmount = document.getElementById('successAmount');
        this.successDesc = document.getElementById('successDesc');
        this.closeSuccessBtn = document.getElementById('closeSuccess');
        this.closeFailedBtn = document.getElementById('closeFailed');
    }

    bindEvents() {
        // Generate QR
        this.generateBtn.addEventListener('click', () => this.generateQRCode());

        // Test buttons
        this.btnSuccess.addEventListener('click', () => this.simulateSuccess());
        this.btnFailed.addEventListener('click', () => this.simulateFailed());

        // New payment
        this.newPaymentBtn.addEventListener('click', () => this.resetForm());

        // Close modals
        this.closeSuccessBtn.addEventListener('click', () => this.closeModal('success'));
        this.closeFailedBtn.addEventListener('click', () => this.closeModal('failed'));

        // Close modal on backdrop click
        this.successModal.addEventListener('click', (e) => {
            if (e.target === this.successModal) this.closeModal('success');
        });
        this.failedModal.addEventListener('click', (e) => {
            if (e.target === this.failedModal) this.closeModal('failed');
        });

        // Enter key to generate
        [this.phoneInput, this.nameInput, this.amountInput, this.descriptionInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.generateQRCode();
            });
        });
    }

    formatAmountInput() {
        this.amountInput.addEventListener('input', (e) => {
            // Remove non-numeric characters
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });
    }

    validateForm() {
        const phone = this.phoneInput.value.trim();
        const name = this.nameInput.value.trim();
        const amount = this.amountInput.value.trim();

        if (!phone || phone.length < 10) {
            this.showAlert('Vui lòng nhập số điện thoại hợp lệ (10 số)');
            this.phoneInput.focus();
            return false;
        }

        if (!name) {
            this.showAlert('Vui lòng nhập tên người nhận');
            this.nameInput.focus();
            return false;
        }

        if (!amount || parseInt(amount) < 1000) {
            this.showAlert('Số tiền tối thiểu là 1,000 VNĐ');
            this.amountInput.focus();
            return false;
        }

        return true;
    }

    showAlert(message) {
        // Simple alert, can be replaced with custom toast
        alert(message);
    }

    generateQRCode() {
        if (!this.validateForm()) return;

        const phone = this.phoneInput.value.trim();
        const name = this.nameInput.value.trim().toUpperCase();
        const amount = parseInt(this.amountInput.value.trim());
        const description = this.descriptionInput.value.trim() || 'Thanh toan';

        // Store current payment info
        this.currentPayment = { phone, name, amount, description };

        // Generate Momo QR content
        // Format: 2|99|PHONE|NAME|0|0|AMOUNT|DESCRIPTION|transfer_myqr
        const qrContent = this.generateMomoQRContent(phone, name, amount, description);

        // Clear previous QR code
        this.qrCodeContainer.innerHTML = '';

        // Generate new QR code
        this.qrCodeInstance = new QRCode(this.qrCodeContainer, {
            text: qrContent,
            width: 200,
            height: 200,
            colorDark: '#a50064',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });

        // Update display
        this.displayName.textContent = name;
        this.displayPhone.textContent = this.formatPhone(phone);
        this.displayAmount.textContent = this.formatCurrency(amount);
        this.displayDescription.textContent = description;

        // Reset status
        this.resetStatus();

        // Show QR section
        this.paymentForm.classList.add('hidden');
        this.qrSection.classList.remove('hidden');

        // Log QR content for debugging
        console.log('QR Content:', qrContent);
    }

    generateMomoQRContent(phone, name, amount, description) {
        /**
         * Momo QR Format Options:
         *
         * 1. Momo Personal QR (nhận tiền cá nhân):
         *    2|99|PHONE|NAME|0|0|AMOUNT|DESCRIPTION|transfer_myqr
         *
         * 2. Momo Deeplink:
         *    https://me.momo.vn/PHONE/AMOUNT
         *
         * 3. Momo App Deeplink:
         *    momo://app?action=payWithApp&isScanQR=true&sid=...
         */

        // Using Momo Personal QR format
        // Remove special characters from description
        const cleanDesc = description.replace(/[|]/g, ' ');

        // Format: 2|99|PHONE|NAME|0|0|AMOUNT|DESCRIPTION|transfer_myqr
        return `2|99|${phone}|${name}|0|0|${amount}|${cleanDesc}|transfer_myqr`;
    }

    formatPhone(phone) {
        // Format: 0912 345 678
        return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    resetStatus() {
        this.statusIndicator.className = 'status-indicator';
        this.statusIndicator.innerHTML = `
            <div class="status-icon pending">⏳</div>
            <span class="status-text">Đang chờ thanh toán...</span>
        `;
    }

    simulateSuccess() {
        // Update status
        this.statusIndicator.className = 'status-indicator success';
        this.statusIndicator.innerHTML = `
            <div class="status-icon">✓</div>
            <span class="status-text">Thanh toán thành công!</span>
        `;

        // Show success modal
        this.successAmount.textContent = this.formatCurrency(this.currentPayment.amount);
        this.successDesc.textContent = this.currentPayment.description;
        this.successModal.classList.remove('hidden');

        // Play success sound (optional)
        this.playSound('success');
    }

    simulateFailed() {
        // Update status
        this.statusIndicator.className = 'status-indicator failed';
        this.statusIndicator.innerHTML = `
            <div class="status-icon">✗</div>
            <span class="status-text">Thanh toán thất bại!</span>
        `;

        // Show failed modal
        this.failedModal.classList.remove('hidden');

        // Play error sound (optional)
        this.playSound('error');
    }

    playSound(type) {
        // Create audio context for notification sounds
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'success') {
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                oscillator.start();
                setTimeout(() => {
                    oscillator.frequency.value = 1000;
                }, 100);
                setTimeout(() => {
                    oscillator.stop();
                }, 200);
            } else {
                oscillator.frequency.value = 300;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 300);
            }
        } catch (e) {
            // Audio not supported
            console.log('Audio not supported');
        }
    }

    closeModal(type) {
        if (type === 'success') {
            this.successModal.classList.add('hidden');
        } else {
            this.failedModal.classList.add('hidden');
        }
    }

    resetForm() {
        // Clear form
        this.phoneInput.value = '';
        this.nameInput.value = '';
        this.amountInput.value = '';
        this.descriptionInput.value = '';

        // Clear QR code
        this.qrCodeContainer.innerHTML = '';
        this.qrCodeInstance = null;
        this.currentPayment = null;

        // Reset status
        this.resetStatus();

        // Show form
        this.qrSection.classList.add('hidden');
        this.paymentForm.classList.remove('hidden');

        // Focus first input
        this.phoneInput.focus();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.momoPayment = new MomoPayment();
});

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('SW registered'))
        //     .catch(err => console.log('SW registration failed'));
    });
}
