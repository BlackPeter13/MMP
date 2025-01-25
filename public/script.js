const socket = io();
const chartCtx = document.getElementById('blockChart').getContext('2d');
const MAX_POINTS = 20;

const chart = new Chart(chartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'BTC Blocks',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
        }, {
            label: 'BCA Blocks',
            data: [],
            borderColor: 'rgb(54, 162, 235)',
            tension: 0.1
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Block Count'
                }
            }
        }
    }
});

socket.on('stats_update', (data) => {
    // Actualizar estadísticas
    document.getElementById('btcBlocks').textContent = data.btc.blocks;
    document.getElementById('btcShares').textContent = data.btc.shares;
    document.getElementById('bcaBlocks').textContent = data.bca.blocks;
    document.getElementById('bcaShares').textContent = data.bca.shares;

    // Actualizar gráfico
    const timestamp = new Date().toLocaleTimeString();
    chart.data.labels.push(timestamp);
    chart.data.datasets[0].data.push(data.btc.blocks);
    chart.data.datasets[1].data.push(data.bca.blocks);

    if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(dataset => dataset.data.shift());
    }

    chart.update();
});

socket.on('log', (logEntry) => {
    const logList = document.getElementById('logList');
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = `[${new Date().toLocaleTimeString()}] ${logEntry}`;

    if (logList.children.length >= 10) {
        logList.removeChild(logList.firstChild);
    }
    logList.appendChild(li);
});
