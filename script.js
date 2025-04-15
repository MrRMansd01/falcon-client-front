document.addEventListener('DOMContentLoaded', function() {
    // Button hover sound effect
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            playHoverSound();
        });
        
        button.addEventListener('click', () => {
            playClickSound();
        });
    });

    // Single player button
    document.querySelector('.single-player').addEventListener('click', () => {
        console.log('Starting single player mode...');
        // Add your single player logic here
    });

    // Multi player button
    document.querySelector('.multi-player').addEventListener('click', () => {
        console.log('Starting multiplayer mode...');
        // Add your multiplayer logic here
    });

    // Bottom icons functionality
    const iconButtons = document.querySelectorAll('.icon-btn');
    iconButtons.forEach(button => {
        button.addEventListener('click', function() {
            const iconType = this.querySelector('img').alt.toLowerCase();
            handleIconClick(iconType);
        });
    });

    // Sound effects function
    function playHoverSound() {
        // Add hover sound effect
        const audio = new Audio('hover.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
    }

    function playClickSound() {
        // Add click sound effect
        const audio = new Audio('click.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    }

    // Handle icon clicks
    function handleIconClick(iconType) {
        switch(iconType) {
            case 'star':
                console.log('Opening favorites...');
                break;
            case 'settings':
                console.log('Opening settings...');
                break;
            case 'book':
                console.log('Opening guide...');
                break;
            case 'users':
                console.log('Opening social...');
                break;
        }
    }
}); 