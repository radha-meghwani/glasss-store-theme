document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('ContactFormRingEnquiry');
  if (!form) return;

  // --- Dynamic Dropdown Logic ---
  const colorSelect = document.getElementById('EnquiryForm-DiamondColor');
  const claritySelect = document.getElementById('EnquiryForm-DiamondClarity');

  const clarityOptions = {
    'White Diamonds': ['D', 'E', 'F', 'G', 'H', 'I'],
    'Fancy Color Diamonds': ['Fancy Deep', 'Fancy Dark', 'Fancy Vivid', 'Fancy Intense', 'Fancy', 'Very Light', 'Fancy Light', 'Light', 'Faint']
  };

  colorSelect.addEventListener('change', (e) => {
    const selectedColor = e.target.value;
    claritySelect.innerHTML = '<option value="" disabled selected>Please Select</option>'; // Reset
    
    if (clarityOptions[selectedColor]) {
      clarityOptions[selectedColor].forEach(optionText => {
        const option = document.createElement('option');
        option.value = optionText;
        option.textContent = optionText;
        claritySelect.appendChild(option);
      });
    } else {
      claritySelect.innerHTML = '<option value="" disabled selected>Please Select Color First</option>';
    }
  });


  // --- File Upload Logic ---
  const fileArea = document.getElementById('FileUploadArea');
  const fileInput = document.getElementById('EnquiryForm-FileInput');
  const filePreview = document.getElementById('FileUploadPreview');
  const fileError = document.getElementById('FileUploadError');
  const hiddenImagesInput = document.getElementById('EnquiryFormHiddenImages');
  const submitButton = document.getElementById('EnquiryFormSubmit');
  const submitText = submitButton.querySelector('.submit-text');
  const loadingSpinner = submitButton.querySelector('.loading-spinner');

  const maxFiles = parseInt(fileArea.dataset.maxFiles, 10) || 3;
  const maxSizeBytes = (parseInt(fileArea.dataset.maxSize, 10) || 15) * 1024 * 1024;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  
  let selectedFiles = [];

  // Open file dialog on click
  fileArea.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle Drag & Drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    fileArea.addEventListener(eventName, () => fileArea.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileArea.addEventListener(eventName, () => fileArea.classList.remove('dragover'), false);
  });

  fileArea.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', function(e) {
    handleFiles(this.files);
    this.value = ''; // Reset input so same file can be selected again if removed
  });

  function handleFiles(files) {
    fileError.style.display = 'none';
    fileError.textContent = '';
    
    let currentFilesCount = selectedFiles.length;
    let newFiles = Array.from(files);

    if (currentFilesCount + newFiles.length > maxFiles) {
      showError(`You can only upload a maximum of ${maxFiles} files.`);
      return;
    }

    let hasError = false;
    newFiles.forEach(file => {
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.jpg')) {
        showError('Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.');
        hasError = true;
      } else if (file.size > maxSizeBytes) {
        showError(`File size exceeds ${(maxSizeBytes / (1024 * 1024))}MB limit: ${file.name}`);
        hasError = true;
      }
    });

    if (hasError) return;

    selectedFiles = [...selectedFiles, ...newFiles];
    renderPreviews();
  }

  function showError(msg) {
    fileError.textContent = msg;
    fileError.style.display = 'block';
  }

  function renderPreviews() {
    filePreview.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = file.name;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-file';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove file';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderPreviews();
      });

      item.appendChild(name);
      item.appendChild(removeBtn);
      filePreview.appendChild(item);
    });
  }

  // --- Form Submission & GoFile Upload ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check custom required fields if any
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setLoadingState(true);
    fileError.style.display = 'none';

    try {
      if (selectedFiles.length > 0) {
        const gofileLinks = await uploadFilesToGoFile(selectedFiles);
        hiddenImagesInput.value = gofileLinks.join(', ');
      }
      
      // Submit the form normally after hidden input is set
      form.submit();
      
    } catch (err) {
      console.error(err);
      showError('An error occurred while uploading files. Please try again later.');
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      submitButton.disabled = true;
      submitText.classList.add('hidden');
      loadingSpinner.classList.remove('hidden');
    } else {
      submitButton.disabled = false;
      submitText.classList.remove('hidden');
      loadingSpinner.classList.add('hidden');
    }
  }

  async function getGoFileServer() {
    try {
      const response = await fetch('https://api.gofile.io/getServer');
      const data = await response.json();
      if (data.status === 'ok') {
        return data.data.server;
      }
    } catch (e) {
      console.warn('Failed to get GoFile server, falling back to store1');
    }
    return 'store1';
  }

  async function uploadFilesToGoFile(files) {
    const server = await getGoFileServer();
    // Using the latest GoFile API upload endpoint
    const uploadUrl = `https://${server}.gofile.io/contents/uploadfile`;
    const downloadLinks = [];

    // Retrieve token if already defined globally in JS, or use a placeholder
    const token = window.gofileToken || window.GOFILE_TOKEN || 'YOUR_GOFILE_ACCOUNT_TOKEN';

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      formData.append('token', token);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed for ${files[i].name}`);
      }
      
      const result = await response.json();
      if (result.status === 'ok' && result.data && result.data.downloadPage) {
        downloadLinks.push(result.data.downloadPage);
      } else {
         throw new Error(`Upload failed for ${files[i].name}`);
      }
    }

    return downloadLinks;
  }
});
