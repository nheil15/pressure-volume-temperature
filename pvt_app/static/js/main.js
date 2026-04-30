document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pvtChart');
    const chartData = window.pvtChartData;

    if (!canvas || !chartData) {
        return;
    }

    const labels = chartData.pressure.map((_, index) => `Point ${index + 1}`);

    const config = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Volume',
                    data: chartData.volume,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.15)',
                    tension: 0.35,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Sample Point',
                    },
                },
                y: {
                    beginAtZero: false,
                },
            },
        },
    };

    new Chart(canvas, config);
});
