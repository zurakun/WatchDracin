// Footer interaction effects
document.addEventListener('DOMContentLoaded', function() {
  // Add current year automatically
  const currentYear = new Date().getFullYear();
  const yearElements = document.querySelectorAll('.copyright');
  
  yearElements.forEach(el => {
    el.innerHTML = el.innerHTML.replace('2025', currentYear);
  });
  
  // Add click animation for developer link
  const devLink = document.querySelector('.dev-link');
  if (devLink) {
    devLink.addEventListener('click', function(e) {
      // Animation effect
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 200);
      
      // Optional: Analytics tracking
      console.log('Developer link clicked');
    });
  }
  
  // Add scroll to top functionality
  const footer = document.querySelector('.simple-footer');
  if (footer) {
    footer.addEventListener('click', function(e) {
      if (e.target.classList.contains('copyright') || 
          e.target.classList.contains('developer-credit')) {
        // Scroll to top smoothly
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    });
  }
});