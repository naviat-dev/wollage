const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const placeholder = document.getElementById('placeholder');
const clearBtn = document.getElementById('clearBtn');
const bgInput = document.getElementById('bgInput');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const generateBtn = document.getElementById('generateBtn');
const statusText = document.getElementById('statusText');
const defaultStatus = 'waiting to generate';

let filesState = [];

const updateStatus = message => {
	statusText.textContent = message;
};

const renderList = () => {
	fileListEl.innerHTML = '';
	if (!filesState.length) {
		placeholder.style.display = 'block';
		fileListEl.appendChild(placeholder);
		return;
	}

	placeholder.style.display = 'none';
	const fragment = document.createDocumentFragment();

	filesState.forEach(file => {
		const figure = document.createElement('figure');
		figure.className = 'preview';

		const img = document.createElement('img');
		const url = URL.createObjectURL(file);
		img.src = url;
		img.alt = file.name;
		img.onload = () => URL.revokeObjectURL(url);

		const caption = document.createElement('figcaption');
		caption.textContent = file.name;

		figure.append(img, caption);
		fragment.appendChild(figure);
	});

	fileListEl.appendChild(fragment);
};

const addFiles = fileList => {
	const incoming = Array.from(fileList).filter(file => file.type.startsWith('image/'));
	filesState = [...filesState, ...incoming];
	renderList();
};

const resetFiles = () => {
	filesState = [];
	fileInput.value = '';
	renderList();
	updateStatus(defaultStatus);
};

dropzone.addEventListener('dragover', event => {
	event.preventDefault();
	dropzone.classList.add('highlight');
});

dropzone.addEventListener('dragleave', () => {
	dropzone.classList.remove('highlight');
});

dropzone.addEventListener('drop', event => {
	event.preventDefault();
	dropzone.classList.remove('highlight');
	if (event.dataTransfer?.files?.length) {
		addFiles(event.dataTransfer.files);
	}
});

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('keydown', event => {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		fileInput.click();
	}
});

fileInput.addEventListener('change', event => addFiles(event.target.files));
clearBtn.addEventListener('click', resetFiles);
generateBtn.addEventListener('click', generateCollage);

function getOptimalRatio(width, height, count) {
	const resRatio = height / width;
	let minDiff = Number.MAX_SAFE_INTEGER;
	const minFactors = [0, 0];

	for (let i = 1; i < count; i++) { // i is height, count / i is width
		if (count % i == 0) {
			let workingRatio = i / (count / i);
			if (Math.abs(resRatio - workingRatio) < minDiff) {
				minDiff = Math.abs(resRatio - workingRatio);
				minFactors[0] = i;
				minFactors[1] = count / i;
			}
		}
	}
	return minFactors;
}

function generateCollage() {
	const width = parseInt(widthInput.value);
	const height = parseInt(heightInput.value);
	const bgColor = bgInput.value || '#ffffff';

	if (!filesState.length) {
		updateStatus('add at least one image to generate output');
		return;
	}

	if (!Number.isFinite(width) || !Number.isFinite(height)) {
		updateStatus('enter valid width and height values');
		return;
	}

	updateStatus(`generating background...`);
	const minFactors = getOptimalRatio(width, height, filesState.length);
	const cellHeight = Math.ceil(height / minFactors[0]);
	const cellWidth = Math.ceil(width / minFactors[1]);
}