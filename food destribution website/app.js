
class LocalDataStore {
    constructor() {
        this.SURPLUS_KEY = 'surplus2serve_alerts';
        this.STATS_KEY = 'surplus2serve_stats';
        
        // Seed initial data if empty so the site isn't blank
        if (!localStorage.getItem(this.SURPLUS_KEY)) {
            this.seedInitialData();
        }
        this.initializeStats();
    }

    seedInitialData() {
        const now = new Date();
        const demoAlerts = [
            {
                id: 'demo1',
                restaurantName: "Joe's Pizza",
                foodType: "Cooked Meals",
                foodDescription: "Pepperoni & Cheese Pizza",
                quantity: "3",
                portions: "12",
                pickupAddress: "123 Main St",
                timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 mins ago
                expiryTime: "14:00",
                status: 'active',
                durationMinutes: 120
            },
            {
                id: 'demo2',
                restaurantName: "Green Grocer",
                foodType: "Fresh Produce",
                foodDescription: "Mixed seasonal vegetables",
                quantity: "8",
                portions: "20",
                pickupAddress: "45 Market Ave",
                timestamp: new Date(now.getTime() - 1000 * 60 * 10).toISOString(), // 10 mins ago
                expiryTime: "16:00",
                status: 'active',
                durationMinutes: 180
            }
        ];
        localStorage.setItem(this.SURPLUS_KEY, JSON.stringify(demoAlerts));
    }

    initializeStats() {
        if (!localStorage.getItem(this.STATS_KEY)) {
            const initialStats = { totalFood: 1250, totalMeals: 3125, totalAlerts: 42, weeklyFood: 310, weeklyMeals: 780, weeklyCO2: 775 };
            localStorage.setItem(this.STATS_KEY, JSON.stringify(initialStats));
        }
    }

    saveSurplusAlert(data) {
        const alerts = this.getAllAlerts();
        const newAlert = {
            id: Date.now().toString(),
            ...data,
            timestamp: new Date().toISOString(),
            status: 'active',
            claimed: false,
            durationMinutes: 120 // Default 2 hours validity
        };
        alerts.unshift(newAlert); // Add to top
        localStorage.setItem(this.SURPLUS_KEY, JSON.stringify(alerts));
        this.updateStats(data);
        return newAlert;
    }

    getAllAlerts() {
        return JSON.parse(localStorage.getItem(this.SURPLUS_KEY) || '[]');
    }

    getActiveAlerts() {
        // Filter logic: Must be status 'active'
        return this.getAllAlerts().filter(a => a.status === 'active');
    }

    claimAlert(alertId, volunteerInfo) {
        const alerts = this.getAllAlerts();
        const index = alerts.findIndex(a => a.id === alertId);
        if (index !== -1) {
            alerts[index].claimed = true;
            alerts[index].status = 'claimed';
            alerts[index].volunteer = volunteerInfo;
            alerts[index].claimedAt = new Date().toISOString();
            localStorage.setItem(this.SURPLUS_KEY, JSON.stringify(alerts));
            return true;
        }
        return false;
    }

    updateStats(newAlert) {
        const stats = this.getStats();
        const qty = parseFloat(newAlert.quantity) || 0;
        const portions = parseInt(newAlert.portions) || 0;

        stats.totalFood += qty;
        stats.totalMeals += portions;
        stats.totalAlerts += 1;
        stats.weeklyFood += qty;
        stats.weeklyMeals += portions;
        stats.weeklyCO2 += (qty * 2.5); // Approx CO2 calc

        localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    }

    getStats() {
        return JSON.parse(localStorage.getItem(this.STATS_KEY));
    }
}

// --- 3. Initialization & DOM ---
const dataStore = new LocalDataStore();
const dom = {
    form: document.getElementById('surplusForm'),
    modal: document.getElementById('successModal'),
    alertsContainer: document.getElementById('alertsContainer'),
    partnersList: document.getElementById('partnersList'),
    activityList: document.getElementById('activityList'),
    toastContainer: null
};

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initScrollEffects();
    
    // Initial Data Render
    updateStatsDisplay();
    displayAlerts();
    updatePartnersList();
    updateActivityList();
    
    // Background simulation
    startLiveSimulation(); 

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (window.scrollY > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });

    // Refresh countdowns/activity every 60s
    setInterval(() => {
        updateCountdowns();
        updateActivityList();
    }, 60000);
});

function initUI() {
    // Create Toast Container
    dom.toastContainer = document.createElement('div');
    dom.toastContainer.className = 'toast-container';
    document.body.appendChild(dom.toastContainer);
}

// --- 4. Render Logic (Visuals) ---

function displayAlerts() {
    const alerts = dataStore.getActiveAlerts();
    dom.alertsContainer.innerHTML = ''; 

    if (alerts.length === 0) {
        dom.alertsContainer.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-inbox"></i>
                <p>No active alerts. Check back soon!</p>
            </div>`;
        return;
    }

    alerts.forEach(alert => createAlertCard(alert));
}

function createAlertCard(data) {
    // Calculate time left based on durationMinutes (default 120)
    const created = new Date(data.timestamp);
    const validUntil = new Date(created.getTime() + (data.durationMinutes * 60000));
    const now = new Date();
    const minutesLeft = Math.floor((validUntil - now) / 60000);

    if (minutesLeft <= 0) return; // Skip expired

    const card = document.createElement('div');
    card.className = 'alert-card reveal';
    card.setAttribute('data-id', data.id);
    
    const isUrgent = minutesLeft < 30 ? 'urgent' : '';

    card.innerHTML = `
        <div class="alert-header">
            <h4>${data.restaurantName}</h4>
            <div class="alert-timer ${minutesLeft < 30 ? 'urgent-text' : ''}">
                <i class="fas fa-clock"></i>
                <span class="expiry-countdown" data-expires="${validUntil.toISOString()}">
                    ${formatTime(minutesLeft)}
                </span>
            </div>
        </div>
        <div class="alert-details">
            <p><i class="fas fa-utensils"></i> <strong>${data.foodType}</strong></p>
            <p><i class="fas fa-info-circle"></i> ${data.foodDescription}</p>
            <p><i class="fas fa-weight-hanging"></i> ${data.quantity}kg (${data.portions} portions)</p>
            <p><i class="fas fa-map-marker-alt"></i> ${data.pickupAddress.substring(0, 30)}...</p>
        </div>
        <div class="alert-actions" style="margin-top:15px; display:flex; gap:10px;">
            <button class="btn btn-primary" style="flex:1" onclick="handleClaimClick('${data.id}')">
                Claim
            </button>
            <button class="btn btn-secondary" style="flex:1" onclick="showAlertDetails('${data.id}')">
                Details
            </button>
        </div>
    `;

    dom.alertsContainer.appendChild(card);
    if(isUrgent) card.classList.add('urgent');
    
    // Animate in
    setTimeout(() => card.classList.add('active'), 50);
}

function updatePartnersList() {
    const alerts = dataStore.getAllAlerts();
    const uniqueRestaurants = [...new Set(alerts.map(a => a.restaurantName))];
    
    if (dom.partnersList) {
        if (uniqueRestaurants.length === 0) {
            dom.partnersList.innerHTML = '<p>No partners yet. Be the first!</p>';
        } else {
            dom.partnersList.innerHTML = uniqueRestaurants.slice(0, 5).map(restaurant => `
                <div class="partner-item" style="margin-bottom:8px; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-check-circle" style="color: var(--primary);"></i> ${restaurant}
                </div>
            `).join('');
        }
    }
}

function updateActivityList() {
    const alerts = dataStore.getAllAlerts();
    const recentAlerts = alerts.slice(0, 5); // Already sorted desc by unshift
    
    if (dom.activityList) {
        if (recentAlerts.length === 0) {
            dom.activityList.innerHTML = '<p>No recent activity</p>';
        } else {
            dom.activityList.innerHTML = recentAlerts.map(alert => {
                const timeAgo = getTimeAgo(new Date(alert.timestamp));
                return `
                    <div class="activity-item" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; gap:15px;">
                        <div class="activity-icon" style="background:rgba(255,255,255,0.1); width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-utensils"></i>
                        </div>
                        <div>
                            <p style="font-size:0.9rem; margin-bottom:2px;"><strong>${alert.restaurantName}</strong> posted ${alert.quantity}kg</p>
                            <p style="font-size:0.8rem; opacity:0.7;">${timeAgo}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// --- 5. Interactions & Forms ---

// Form Submission
dom.form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = dom.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Loading Animation
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing...';
    
    setTimeout(() => {
        // Gather ALL form data
        const formData = {
            restaurantName: document.getElementById('restaurantName').value,
            contactPerson: document.getElementById('contactPerson').value,
            contactNumber: document.getElementById('contactNumber').value,
            email: document.getElementById('email').value,
            foodType: document.getElementById('foodType').value,
            foodDescription: document.getElementById('foodDescription').value,
            quantity: document.getElementById('quantity').value,
            portions: document.getElementById('portions').value,
            prepTime: document.getElementById('prepTime').value,
            expiryTime: document.getElementById('expiryTime').value,
            pickupAddress: document.getElementById('pickupAddress').value,
            specialInstructions: document.getElementById('specialInstructions').value,
        };

        // Save & Notify
        dataStore.saveSurplusAlert(formData);
        
        // Reset UI
        dom.form.reset();
        submitBtn.innerHTML = originalText;
        dom.modal.style.display = 'flex';
        
        // Refresh Lists
        updateStatsDisplay();
        displayAlerts();
        updatePartnersList();
        updateActivityList();
        
        showToast("Success", "Alert broadcasted to volunteers!", "fa-bullhorn");
    }, 1200);
});

// Claim Button Logic
window.handleClaimClick = function(id) {
    const volunteerName = prompt('Please enter your name to claim:');
    if (!volunteerName) return;

    const success = dataStore.claimAlert(id, { name: volunteerName });
    
    if (success) {
        displayAlerts(); // Re-render to remove the claimed item or update status
        updateStatsDisplay();
        showToast("Claimed", `Thanks ${volunteerName}! Pickup details sent.`, "fa-check-circle");
    }
};

// Details Button Logic
window.showAlertDetails = function(id) {
    const alerts = dataStore.getAllAlerts();
    const alert = alerts.find(a => a.id === id);
    if(alert) {
        // Simple alert for now, could be a custom modal
        const info = `
            DETAILS FOR: ${alert.restaurantName}
            --------------------------------
            Contact: ${alert.contactPerson} (${alert.contactNumber})
            Food: ${alert.foodDescription}
            Qty: ${alert.quantity}kg
            Expires: ${alert.expiryTime}
            Instructions: ${alert.specialInstructions || 'None'}
            
            Address: ${alert.pickupAddress}
        `;
        window.alert(info);
    }
};

// --- 6. Utilities & Helpers ---

function updateStatsDisplay() {
    const stats = dataStore.getStats();
    
    animateValue("totalFood", stats.totalFood, " kg");
    animateValue("totalMeals", stats.totalMeals, "");
    animateValue("totalAlerts", stats.totalAlerts, "");
    
    if(document.getElementById('weeklyFood')) {
        document.getElementById('weeklyFood').textContent = stats.weeklyFood.toFixed(1) + " kg";
        document.getElementById('weeklyMeals').textContent = stats.weeklyMeals;
        document.getElementById('weeklyCO2').textContent = stats.weeklyCO2.toFixed(1) + " kg";
    }
}

function animateValue(id, end, suffix) {
    const obj = document.getElementById(id);
    if(!obj) return;
    obj.innerText = Math.floor(end) + suffix;
}

// Countdown Ticker
function updateCountdowns() {
    document.querySelectorAll('.expiry-countdown').forEach(el => {
        const expires = new Date(el.dataset.expires);
        const now = new Date();
        const minutesLeft = Math.floor((expires - now) / 60000);

        if (minutesLeft <= 0) {
            el.textContent = "Expired";
            el.closest('.alert-card').style.opacity = "0.5";
        } else {
            el.textContent = formatTime(minutesLeft);
        }
    });
}

function formatTime(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return Math.floor(hours / 24) + " days ago";
}

// --- 7. Animation & Modal Utils ---

// Toast Notifications
function showToast(title, message, iconClass) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
        <div class="toast-content">
            <h5>${title}</h5>
            <p>${message}</p>
        </div>
    `;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Modal Close Logic
function hideModal() {
    dom.modal.style.display = 'none';
}
const closeIcon = document.querySelector('.close');
if (closeIcon) closeIcon.onclick = hideModal;

const closeBtn = document.getElementById('closeModalBtn');
if (closeBtn) closeBtn.onclick = hideModal;

window.onclick = (e) => { if (e.target == dom.modal) hideModal(); };

// Scroll Effects
function initScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Fake Live Activity
function startLiveSimulation() {
    const actions = [
        { text: "Just donated 5kg of bread", icon: "fa-bread-slice" },
        { text: "Claimed 10 meals", icon: "fa-hand-holding-heart" },
        { text: "Volunteer en route", icon: "fa-car" },
    ];
    const partners = ['Starbucks', 'Local Bakery', 'Whole Foods'];

    const loop = () => {
        const randomTime = Math.random() * (20000 - 8000) + 8000;
        setTimeout(() => {
            const action = actions[Math.floor(Math.random() * actions.length)];
            const partner = partners[Math.floor(Math.random() * partners.length)];
            showToast(partner, action.text, action.icon);
            loop();
        }, randomTime);
    };
    loop();
}
