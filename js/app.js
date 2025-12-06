/**
 * Momo QR Payment - Tích hợp API Momo Sandbox
 */

class MomoPayment {
    constructor() {
        this.currentPayment = null;
        this.pollingInterval = null;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.formatAmountInput();
        this.checkUrlParams();
    }

    bindElements() {
        // Form elements
        this.phoneInput = document.getElementById('phoneNumber');
        this.nameInput = document.getElementById('receiverName');
        this.amountInput = document.getElementById('amount');
        this.descriptionInput = document.getElementById('description');
        this.generateBtn = document.getElementById('generateQR');
        this.loadingCreate = document.getElementById('loadingCreate');

        // Sections
        this.paymentForm = document.getElementById('paymentForm');
        this.qrSection = document.getElementById('qrSection');
        this.qrCodeImage = document.getElementById('qrCodeImage');

        // Display elements
        this.displayOrderId = document.getElementById('displayOrderId');
        this.displayName = document.getElementById('displayName');
        this.displayAmount = document.getElementById('displayAmount');
        this.displayDescription = document.getElementById('displayDescription');

        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');

        // Buttons
        this.newPaymentBtn = document.getElementById('newPayment');

        // Modals
        this.successModal = document.getElementById('successModal');
        this.failedModal = document.getElementById('failedModal');
        this.successAmount = document.getElementById('successAmount');
        this.successDesc = document.getElementById('successDesc');
        this.successTransId = document.getElementById('successTransId');
        this.failedMessage = document.getElementById('failedMessage');
        this.closeSuccessBtn = document.getElementById('closeSuccess');
        this.closeFailedBtn = document.getElementById('closeFailed');
    }

    bindEvents() {
        // Generate QR
        this.generateBtn.addEventListener('click', () => this.createPayment());

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
                if (e.key === 'Enter') this.createPayment();
            });
        });
    }

    formatAmountInput() {
        this.amountInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });
    }

    // Kiểm tra URL params khi redirect về từ Momo
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        const status = urlParams.get('status');
        const message = urlParams.get('message');

        if (orderId && status) {
            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);

            if (status === 'success') {
                this.showSuccess({
                    amount: 0,
                    orderInfo: 'Thanh toán thành công',
                    transId: orderId
                });
            } else {
                this.showFailed(message || 'Thanh toán thất bại');
            }
        }
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
        alert(message);
    }

    showLoading(show) {
        if (show) {
            this.generateBtn.classList.add('hidden');
            this.loadingCreate.classList.remove('hidden');
        } else {
            this.generateBtn.classList.remove('hidden');
            this.loadingCreate.classList.add('hidden');
        }
    }

    async createPayment() {
        if (!this.validateForm()) return;

        const phone = this.phoneInput.value.trim();
        const name = this.nameInput.value.trim().toUpperCase();
        const amount = parseInt(this.amountInput.value.trim());
        const description = this.descriptionInput.value.trim() || 'Thanh toan';

        this.showLoading(true);

        try {
            const response = await fetch('/api/create-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
                    orderInfo: `${description} - ${name}`,
                    phone: phone,
                    name: name
                })
            });

            const data = await response.json();
            console.log('Payment created:', data);

            if (data.success && data.qrCodeUrl) {
                this.currentPayment = {
                    orderId: data.orderId,
                    phone,
                    name,
                    amount,
                    description,
                    qrCodeUrl: data.qrCodeUrl,
                    payUrl: data.payUrl
                };

                this.showQRCode();
                this.startPolling();
            } else {
                throw new Error(data.message || 'Không thể tạo mã thanh toán');
            }

        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Lỗi: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showQRCode() {
        // Hiển thị QR code từ Momo
        this.qrCodeImage.src = this.currentPayment.qrCodeUrl;

        // Cập nhật thông tin
        this.displayOrderId.textContent = this.currentPayment.orderId;
        this.displayName.textContent = this.currentPayment.name;
        this.displayAmount.textContent = this.formatCurrency(this.currentPayment.amount);
        this.displayDescription.textContent = this.currentPayment.description;

        // Reset status
        this.updateStatus('pending');

        // Hiển thị QR section
        this.paymentForm.classList.add('hidden');
        this.qrSection.classList.remove('hidden');
    }

    updateStatus(status, message = '') {
        this.statusIndicator.className = 'status-indicator';

        switch (status) {
            case 'pending':
                this.statusIndicator.innerHTML = `
                    <div class="status-icon pending">
                        <div class="spinner-small"></div>
                    </div>
                    <span class="status-text">Đang chờ thanh toán...</span>
                `;
                break;
            case 'success':
                this.statusIndicator.classList.add('success');
                this.statusIndicator.innerHTML = `
                    <div class="status-icon">✓</div>
                    <span class="status-text">Thanh toán thành công!</span>
                `;
                break;
            case 'failed':
                this.statusIndicator.classList.add('failed');
                this.statusIndicator.innerHTML = `
                    <div class="status-icon">✗</div>
                    <span class="status-text">${message || 'Thanh toán thất bại'}</span>
                `;
                break;
        }
    }

    startPolling() {
        // Polling mỗi 3 giây để kiểm tra trạng thái
        this.pollingInterval = setInterval(async () => {
            await this.checkPaymentStatus();
        }, 3000);

        // Timeout sau 10 phút
        setTimeout(() => {
            this.stopPolling();
        }, 600000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async checkPaymentStatus() {
        if (!this.currentPayment) return;

        try {
            // Kiểm tra local status trước
            const localResponse = await fetch(`/api/payment-status/${this.currentPayment.orderId}`);
            const localData = await localResponse.json();

            if (localData.status === 'success') {
                this.stopPolling();
                this.updateStatus('success');
                this.showSuccess(localData);
                return;
            }

            if (localData.status === 'failed') {
                this.stopPolling();
                this.updateStatus('failed', localData.message);
                this.showFailed(localData.message);
                return;
            }

            // Query trực tiếp từ Momo API
            const queryResponse = await fetch('/api/query-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: this.currentPayment.orderId })
            });

            const queryData = await queryResponse.json();
            console.log('Query status:', queryData);

            if (queryData.resultCode === 0) {
                this.stopPolling();
                this.updateStatus('success');
                this.showSuccess(queryData);
            } else if (queryData.resultCode && queryData.resultCode !== 1000) {
                // 1000 = pending, others = error
                this.stopPolling();
                this.updateStatus('failed', queryData.message);
                this.showFailed(queryData.message);
            }

        } catch (error) {
            console.error('Error checking status:', error);
        }
    }

    showSuccess(data) {
        this.successAmount.textContent = this.formatCurrency(data.amount || this.currentPayment?.amount || 0);
        this.successDesc.textContent = data.orderInfo || this.currentPayment?.description || '';
        this.successTransId.textContent = `Mã GD: ${data.transId || '-'}`;
        this.successModal.classList.remove('hidden');
    }

    showFailed(message) {
        this.failedMessage.textContent = message || 'Giao dịch không thể hoàn tất.';
        this.failedModal.classList.remove('hidden');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    closeModal(type) {
        if (type === 'success') {
            this.successModal.classList.add('hidden');
            this.resetForm();
        } else {
            this.failedModal.classList.add('hidden');
        }
    }

    resetForm() {
        this.stopPolling();

        // Clear form
        this.phoneInput.value = '';
        this.nameInput.value = '';
        this.amountInput.value = '';
        this.descriptionInput.value = '';

        // Clear payment
        this.currentPayment = null;

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
