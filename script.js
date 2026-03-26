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
const outputImage = document.getElementById('outputImage');
const outputPlaceholder = document.getElementById('outputPlaceholder');
const downloadBtn = document.getElementById('downloadBtn');

let filesState = [];
let outputBlobUrl = null;
let outputBlob = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hydrateResolutionDefaults = () => {
	const pixelRatio = window.devicePixelRatio || 1;
	const screenWidth = Math.round((window.screen?.width || window.innerWidth) * pixelRatio);
	const screenHeight = Math.round((window.screen?.height || window.innerHeight) * pixelRatio);
	const minWidth = parseInt(widthInput.min, 10) || 1;
	const maxWidth = parseInt(widthInput.max, 10) || screenWidth;
	const minHeight = parseInt(heightInput.min, 10) || 1;
	const maxHeight = parseInt(heightInput.max, 10) || screenHeight;

	widthInput.value = clamp(screenWidth, minWidth, maxWidth);
	heightInput.value = clamp(screenHeight, minHeight, maxHeight);
};

const updateStatus = message => {
	statusText.textContent = message;
};

const resetOutputPreview = () => {
	if (outputBlobUrl) {
		URL.revokeObjectURL(outputBlobUrl);
		outputBlobUrl = null;
	}
	outputBlob = null;
	if (outputImage) {
		outputImage.removeAttribute('src');
		outputImage.hidden = true;
	}
	if (outputPlaceholder) {
		outputPlaceholder.style.display = 'block';
	}
	downloadBtn.disabled = true;
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
		figure.id = `file-${file.name.replace(/\s+/g, '-')}`;

		const img = document.createElement('img');
		const url = URL.createObjectURL(file);
		img.src = url;
		img.alt = file.name;
		img.onload = () => URL.revokeObjectURL(url);

		const caption = document.createElement('figcaption');
		caption.textContent = file.name;

		figure.append(img, caption);
		figure.addEventListener('click', () => {
			const confirmed = window.confirm(`Remove ${file.name} from the collage?`);
			if (!confirmed) return;
			filesState = filesState.filter(f => f !== file);
			renderList();
		});
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
hydrateResolutionDefaults();
resetOutputPreview();

function getOptimalRatio(width, height, count) {
	if (count <= 1) return [1, 1];
	const resRatio = height / width;
	let minDiff = Number.MAX_SAFE_INTEGER;
	const minFactors = [1, count];

	for (let i = 1; i <= count; i++) {
		if (count % i === 0) {
			const workingRatio = i / (count / i);
			const diff = Math.abs(resRatio - workingRatio);
			if (diff < minDiff) {
				minDiff = diff;
				minFactors[0] = i;
				minFactors[1] = count / i;
			}
		}
	}

	if (minDiff > 0.1) { // the maximum compatible ratio diff is too large to be reasonable for the wallpaper
		for (let i = 1; i <= count; i++) { // run it again, but this time ignore the exact factors and just find the closest ratio
			const workingRatio = i / (count / i);
			const diff = Math.abs(resRatio - workingRatio);
			if (diff < minDiff) {
				minDiff = diff;
				minFactors[0] = i;
				minFactors[1] = Math.floor(count / i);
			}
		}
	}
	console.log(`optimal ratio for ${count} images at ${width}x${height} is ${minFactors[0]} rows x ${minFactors[1]} columns`);
	return minFactors;
}

const canvasToBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

const showOutputPreview = async canvas => {
	const blob = await canvasToBlob(canvas);
	if (!blob) {
		updateStatus('unable to export image');
		return;
	}
	if (outputBlobUrl) {
		URL.revokeObjectURL(outputBlobUrl);
	}
	outputBlob = blob;
	outputBlobUrl = URL.createObjectURL(blob);
	outputImage.src = outputBlobUrl;
	outputImage.hidden = false;
	outputPlaceholder.style.display = 'none';
	downloadBtn.disabled = false;
};

const downloadOutput = () => {
	if (!outputBlobUrl) return;
	const link = document.createElement('a');
	link.href = outputBlobUrl;
	const width = widthInput.value || 'output';
	const height = heightInput.value || '';
	link.download = `wollage-${width}${height ? 'x' + height : ''}.png`;
	document.body.appendChild(link);
	link.click();
	link.remove();
};

downloadBtn.addEventListener('click', downloadOutput);

async function generateCollage() {
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

	updateStatus('generating background...');
	outputPlaceholder.style.display = 'block';
	outputImage.hidden = true;
	downloadBtn.disabled = true;

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	const minFactors = getOptimalRatio(width, height, filesState.length);
	const squareSize = Math.ceil(Math.max(width / minFactors[1], height / minFactors[0]));
	const indices = [...Array(filesState.length).keys()];

	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}

	for (let i = 0; i < indices.length; i++) {
		updateStatus(`processing image ${i + 1} / ${indices.length}`);
		const img = await createImageBitmap(filesState[indices[i]]);
		const scale = 1 + Math.random() * 0.5; // random scale between 1 and 1.5
		const rotation = (Math.random() - 0.5) * 45; // random rotation between -22.5 and 22.5 degrees
		const row = Math.floor(i / minFactors[1]);
		const col = i % minFactors[1];
		const x = col * squareSize;
		const y = row * squareSize;
		ctx.save();
		ctx.translate(x + squareSize / 2, y + squareSize / 2);
		ctx.rotate((rotation * Math.PI) / 180);
		ctx.scale(scale, scale);
		ctx.translate(-squareSize / 2, -squareSize / 2);
		const size = Math.min(img.width, img.height);

		ctx.drawImage(
			img,
			(img.width - size) / 2, (img.height - size) / 2, size, size,   // crop source
			0, 0, squareSize, squareSize
		);
		ctx.restore();
	}

	await showOutputPreview(canvas);
	updateStatus(`ready: ${filesState.length} images prepared for ${width} × ${height}px output`);
}