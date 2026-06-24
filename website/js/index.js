const THEME_STORAGE_KEY = 'mytabsearch-theme-preference';

function getSavedTheme() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
        console.error('Get saved theme error:', error);
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        console.error('Save theme error:', error);
    }
}

function applyTheme(theme) {
    const html = document.documentElement;
    const btn = document.querySelector('.theme-toggle i');
    
    if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
        if (btn) btn.className = 'fas fa-sun';
    } else {
        html.removeAttribute('data-theme');
        if (btn) btn.className = 'fas fa-moon';
    }
}

function getDefaultTheme() {
    const now = new Date();
    const hour = now.getHours();
    return (hour >= 6 && hour < 19) ? 'light' : 'dark';
}

function initTheme() {
    const savedTheme = getSavedTheme();
    const theme = savedTheme || getDefaultTheme();
    applyTheme(theme);
}

function toggleTheme() {
    try {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        applyTheme(newTheme);
        saveTheme(newTheme);
    } catch (error) {
        console.error('Theme toggle error:', error);
    }
}

initTheme();

let slideIndex = 1;
let lightboxIndex = 1;
let lightboxScale = 1;

function resetSlideInterval() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        changeSlide(1);
    }, 5000);
}

function changeSlide(n) {
    showSlides(slideIndex += n);
    resetSlideInterval();
}

function currentSlide(n) {
    showSlides(slideIndex = n);
    resetSlideInterval();
}

function showSlides(n) {
    const slides = document.getElementsByClassName("carousel-slide");
    const indicators = document.getElementsByClassName("indicator");

    if (n > slides.length) {
        slideIndex = 1
    }
    if (n < 1) {
        slideIndex = slides.length
    }

    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove('active');
    }

    for (let i = 0; i < indicators.length; i++) {
        indicators[i].classList.remove('active');
    }

    slides[slideIndex - 1].classList.add('active');
    if (indicators[slideIndex - 1]) {
        indicators[slideIndex - 1].classList.add('active');
    }
}

function openLightbox(index) {
    lightboxIndex = index;
    lightboxScale = 1;
    updateLightboxImage();
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    lightboxScale = 1;
}

function updateLightboxImage() {
    const slides = document.querySelectorAll('.carousel-slide img');
    const lightboxImg = document.querySelector('.lightbox-image');
    const counter = document.querySelector('.lightbox-counter');
    
    if (!slides.length || !lightboxImg) return;
    
    const targetIndex = lightboxIndex - 1;
    if (targetIndex >= 0 && targetIndex < slides.length) {
        lightboxImg.src = slides[targetIndex].src;
        lightboxImg.alt = slides[targetIndex].alt;
        lightboxImg.style.transform = `scale(${lightboxScale})`;
        if (counter) {
            counter.textContent = `${lightboxIndex} / ${slides.length}`;
        }
    }
}

function lightboxNavigate(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;
    
    if (totalSlides === 0) return;
    
    lightboxIndex += direction;
    
    if (lightboxIndex < 1) {
        lightboxIndex = totalSlides;
    } else if (lightboxIndex > totalSlides) {
        lightboxIndex = 1;
    }
    
    lightboxScale = 1;
    updateLightboxImage();
}

function lightboxZoom(delta) {
    lightboxScale += delta * 0.1;
    lightboxScale = Math.max(0.5, Math.min(2, lightboxScale));
    
    const lightboxImg = document.querySelector('.lightbox-image');
    if (lightboxImg) {
        lightboxImg.style.transform = `scale(${lightboxScale})`;
    }
}

function bindEventListeners() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const prevBtn = document.querySelector('.carousel-controls .prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => changeSlide(-1));
    }

    const nextBtn = document.querySelector('.carousel-controls .next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => changeSlide(1));
    }

    const indicators = document.querySelectorAll('.carousel-indicators .indicator');
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => currentSlide(index + 1));
    });

    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        const lightboxOverlay = document.querySelector('.lightbox-overlay');
        if (lightboxOverlay) {
            lightboxOverlay.addEventListener('click', closeLightbox);
        }

        const lightboxClose = document.querySelector('.lightbox-close');
        if (lightboxClose) {
            lightboxClose.addEventListener('click', closeLightbox);
        }

        const lightboxPrev = document.querySelector('.lightbox-prev');
        if (lightboxPrev) {
            lightboxPrev.addEventListener('click', () => lightboxNavigate(-1));
        }

        const lightboxNext = document.querySelector('.lightbox-next');
        if (lightboxNext) {
            lightboxNext.addEventListener('click', () => lightboxNavigate(1));
        }

        const lightboxImageContainer = document.querySelector('.lightbox-image-container');
        if (lightboxImageContainer) {
            lightboxImageContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -1 : 1;
                lightboxZoom(delta);
            });
            lightboxImageContainer.addEventListener('click', closeLightbox);
        }
    }

    const carouselSlides = document.querySelectorAll('.carousel-slide img');
    carouselSlides.forEach((img, index) => {
        img.addEventListener('click', () => {
            openLightbox(index + 1);
        });
        img.style.cursor = 'pointer';
    });

    document.addEventListener('keydown', (e) => {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox || !lightbox.classList.contains('active')) return;
        
        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                lightboxNavigate(-1);
                break;
            case 'ArrowRight':
                lightboxNavigate(1);
                break;
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    showSlides(slideIndex);
}

let slideInterval;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEventListeners);
} else {
    bindEventListeners();
}

resetSlideInterval();