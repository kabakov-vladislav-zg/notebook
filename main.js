function ready(){	
	let buttonInputNote = document.querySelector('#buttonInputNote');
	let areaInputNote = document.querySelector('#areaInputNote');
	let sectionNoteStorage = document.querySelector('#sectionNoteStorage');
	let sectionSearchResults = document.querySelector('#sectionSearchResults');
	let tagList = document.querySelector('#tagList');
	let buttonRemoveResults;
	let buttonDescription = document.querySelector('#buttonDescription');
	let buttonMenu = document.querySelector('#buttonMenu');
	let date = new Date();
	let db;


	let request = indexedDB.open('noteStorage', 1);

	request.onupgradeneeded = () => {
		db = request.result;

    	let noteStorage;
		if (!db.objectStoreNames.contains('notes')) {
			noteStorage = db.createObjectStore('notes', {keyPath: 'id', autoIncrement:true});
		} else {
			noteStorage = request.transaction.objectStore('notes');
		}

		if (!noteStorage.indexNames.contains('tags_id')) {
			noteStorage.createIndex('tags_id', 'tags', {multiEntry:true});
		}
	};

	request.onerror = () => {
		alert('error opening database ' + request.errorCode);
	};

	request.onsuccess = () => {
		db = request.result;
		getAllNotes().then((result) => {
			let notes = result;

			for(let note of notes) {
				displayNotes(note, sectionNoteStorage);
			};
		});

		getTags().then((result) => {
			let tags = result;
			displayTags(tags);
		});
	};

	addTagTrigger(tagList);

	addHoverAnimation(buttonInputNote);
	addHoverAnimation(buttonDescription);

	buttonInputNote.onclick = () => {
		let addNote = new Event('addNote');
		document.dispatchEvent(addNote);
	};

	document.addEventListener('keyup', (event) => {
		if ((event.code == 'Enter' && (event.ctrlKey || event.metaKey)) &&
			(areaInputNote == document.activeElement)) {
			let addNote = new Event('addNote');
			document.dispatchEvent(addNote);
		}
	});

	document.addEventListener('addNote', () => {
		let text = areaInputNote.value;
		let note = processText(text);

		setNote(note).then((result) => {
			note.id = result;
			displayNotes(note, sectionNoteStorage);
		})
		if (note.tags) {
			getTags().then((result) => {
				let tags = result;
				displayTags(tags);
			});
		};
		areaInputNote.value = '';
	});

	buttonDescription.onclick = () => {
		onPopUp();

		let buttonEscPopUp = document.querySelector('#buttonEscPopUp');

		buttonEscPopUp.onclick = () => {
			offPopUp();
		}
	};

	buttonMenu.onclick = () => {

		onSideBar();

		let buttonEscape = document.querySelector('#buttonEscape');

		buttonEscape.onclick = () => {
			offSideBar();	
		}
	}

	function addTagTrigger(elem) {
		elem.onclick = (event) => {
			offSideBar();

			sectionSearchResults.innerHTML = '';
			let target = event.target.closest('.tag');
			if (!target) return;
			let tag = target.value;

			getNoteByTag(tag).then((result) => {
				let notes = result;
				for (let note of notes){
					displayNotes(note, sectionSearchResults);
				}
			});

			sectionNoteStorage.classList.add('visibility-hidden');

			if (buttonRemoveResults){
				buttonRemoveResults.remove();
			}
			tagList.insertAdjacentHTML(
				'beforebegin',
				`<button class="botton-text button-remove-results" id="buttonRemoveResults" tabindex="32767">
					<span class="button-remove-results__content">
						<span class="tag">${tag}</span>
						<span>&#10006;</span>
					</span>
				</button>`
			);

			buttonRemoveResults = document.querySelector('#buttonRemoveResults');

			buttonRemoveResults.onclick = () => {
				sectionSearchResults.innerHTML = '';
				sectionNoteStorage.classList.remove('visibility-hidden');
				buttonRemoveResults.remove();
			}
		}
	}

	function addDeleteTrigger(targetButton, key, tags) {
		targetButton.onclick = () => {
			let targetNote = event.target.closest('.note');
			targetNote.insertAdjacentHTML(
				'afterbegin',
				`<div class="warning" id="deleteForm">
					<div class="warning__content">Вы хотите удалить заметку?</div>
					<div>
						<button class="button botton_dark warning__content" id="deleteYes">
							<span class="blink blink_red"><span></span></span>
							<span class="blink blink_blue"><span></span></span>
							<span>удалить</span>
						</button>
						<button class="button botton_dark warning__content" id="deleteNo">
							<span class="blink blink_red"><span></span></span>
							<span class="blink blink_blue"><span></span></span>
							<span>хотя...неее</span>
						</button>
					</div>
				</div>`
			);
			let deleteForm = document.querySelector('#deleteForm');
			let deleteYes = document.querySelector('#deleteYes');
			let deleteNo = document.querySelector('#deleteNo');

			addHoverAnimation(deleteYes);
			addHoverAnimation(deleteNo);

			deleteNo.onclick = () => deleteForm.remove();
			deleteYes.onclick = () => {
				deleteNote(key);
				let notes = document.querySelectorAll('.' + 'id_' + key);
				for (let note of notes){
					note.remove();
				}

				if (tags) {
					getTags().then((result) => {
						let tags = result;
						displayTags(tags);
					});
				};
				if (buttonRemoveResults && 
					sectionSearchResults.innerHTML == ''){

					sectionNoteStorage.classList.remove('visibility-hidden');
					buttonRemoveResults.remove();
				};
			}
		}
	}

	async function getAllNotes() {
		let promise = new Promise((resolve, reject) => {
	    	let notes = [];
			let transaction = db.transaction('notes', 'readonly');
			let noteStore = transaction.objectStore('notes');

			let request = noteStore.openCursor();
			request.onsuccess = () => {
				let cursor = request.result;
				if (cursor) {
					let note = cursor.value;
					notes.push(note);
					cursor.continue();
				} else resolve(notes);
			}
		});

		let result = await promise;
		return result;
	}

	async function setNote(note) {
		let promise = new Promise((resolve, reject) => {
			let transaction = db.transaction('notes', 'readwrite');
			let noteStore = transaction.objectStore('notes');

			let request = noteStore.add(note);
			request.onsuccess = () => {
		        key = request.result;
		        resolve(key);
		    };
		});

		let result = await promise;
		return result;
	}

	function deleteNote(key){
		let transaction = db.transaction('notes', 'readwrite');
		let noteStore = transaction.objectStore('notes');
		let request = noteStore.delete(key);
	}

	async function getTags() {
		let promise = new Promise((resolve, reject) => {
			let tags = [];
			let transaction = db.transaction('notes', 'readonly');
			let notes = transaction.objectStore('notes');
			let index = notes.index('tags_id');

			let request = index.openCursor(null, 'nextunique');

			request.onsuccess = () => {
				let cursor = request.result;
				if (cursor) {
					let tag = cursor.key;
					tags.push(tag);
					cursor.continue();
				} else  resolve(tags);
			}
		});

		let result = await promise;
		return result;
	}

	async function getNoteByTag(tag) {
		let promise = new Promise((resolve, reject) => {
			let notes = [];
			let transaction = db.transaction('notes', 'readonly');
			let noteStore = transaction.objectStore('notes');
			let tagIndex = noteStore.index('tags_id');

			let request = tagIndex.openCursor(tag);
			request.onsuccess = () => {
				let cursor = request.result;
				if (cursor) {
					let note = cursor.value;
					notes.push(note);
					cursor.continue();
				} else resolve(notes);
			}
		});

		let result = await promise;
		return result;
	}

	function displayNotes(note, site){
		site.insertAdjacentHTML(
			'afterbegin',
			`<article class="note id_${note.id}">
				<p>${note.text}</p>
				<footer class="note__date">${note.time}</footer>
				<div class="note__button-symbol button-symbol">
					<div class="button-symbol__content">
						<label class="button-symbol__label" for="buttonDelete_${note.id}">
							удалить заметку
						</label>
						<button class="button-symbol__button" id="buttonDelete_${note.id}">
							<span>&#10006;</span>
						</button>
					</div>
			  	</div>
			</article>`
		);

		let newNote = site.querySelector('.note');
		let buttonDelete = newNote.querySelector(`#buttonDelete_${note.id}`);
		let id = note.id;
		let tags = note.tags

		addDeleteTrigger(buttonDelete, id, tags);

		if (tags){
			newNote.insertAdjacentHTML(
				'afterbegin',
				`<header class="note__tags"></header>`
			);
			let tagList = newNote.querySelector('.note__tags');
			for (let tag of tags){
				tagList.insertAdjacentHTML(
					'afterbegin',
					`<input type="button" class="tag note__botton-text botton-text botton-text_small" value="${tag}">`
				);
			}
			addTagTrigger(tagList);
		}
	}


	function displayTags(tags) {
		tagList.innerHTML = '';

		for (let tag of tags){
			tagList.insertAdjacentHTML(
				'afterbegin',
				`<li>
					<input type="button" class="tag botton-text botton-text_small" value="${tag}" tabindex="4">
				</li>`
			);
		}
	}

	function processText(text) {
		let tags = [];
		let regexp = /#\S+/g;
		tags = text.match(regexp);
		if (tags) tags.reverse();
		text = text.replace(regexp, '');
		text = text.replace(/\n/g, '<br>');
		text = text.replace(/\s/g, '&nbsp');
		let time = `${date.getHours()}:${date.getMinutes()} ${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`;

		let note = {
			text, 
			tags,
			time
		};

		return note;
	}

	function onPopUp() {
		let header = document.querySelector('.header__content');
		let sideBar = document.querySelector('.side-bar__content');
		let popUp = document.querySelector('.pop-up');
		popUp.className = 'pop-up pop-up_off';

		if (!sideBar.classList.contains('slide-side-bar__content_off')){
			sideBar.classList.add('slide-side-bar__content_off');
			header.classList.add('slide-side-bar__content_off');
			popUp.classList.add('slide-pop-up_on');

			setTimeout(() => {
				sideBar.className = 'side-bar__content side-bar_off';
				header.className = 'header__content header_off';
				popUp.className = 'pop-up pop-up_on';
			}, 500);
		};
	}
	
	function offPopUp() {
		let header = document.querySelector('.header__content');
		let sideBar = document.querySelector('.side-bar__content');
		let popUp = document.querySelector('.pop-up');
		popUp.className = 'pop-up pop-up_off';

		if (!sideBar.classList.contains('slide-side-bar__content_on')){
			sideBar.classList.add('slide-side-bar__content_on');
			header.classList.add('slide-side-bar__content_on');
			popUp.classList.add('slide-pop-up_off');

			setTimeout(() => {
				sideBar.className = 'side-bar__content';
				header.className = 'header__content';
				popUp.className = 'pop-up';		
			}, 500);		
		};
	}

	function onSideBar() {
		let sideBar = document.querySelector('.side-bar');

		sideBar.className = 'side-bar side-bar_off';

		if (!sideBar.classList.contains('slide-side-bar_on')){
			sideBar.classList.add('slide-side-bar_on');

			setTimeout(() => {
				sideBar.className = 'side-bar side-bar_on';
			}, 250);
		};
	}

	function offSideBar() {
		let sideBar = document.querySelector('.side-bar');
		
		if (!sideBar.classList.contains('slide-side-bar_off') &&
			sideBar.classList.contains('side-bar_on')){
			sideBar.classList.add('slide-side-bar_off');

			setTimeout(() => {
				sideBar.className = 'side-bar';
			}, 250);	
		};
	}

	function addHoverAnimation(targetElem) {
		targetElem.onmouseover = () => {
			let blinks = targetElem.querySelectorAll('.blink');
			for (let blink of blinks){
				blink.classList.add('blink_on');
			}
			targetElem.onmouseout = () => {
				for (let blink of blinks){
					blink.classList.remove('blink_on');
				}
			}
		}
	}

}
document.addEventListener('DOMContentLoaded', ready);

window.onload = () => document.querySelector('.preloader').remove();

let vh = document.documentElement.clientHeight * 0.01;
document.documentElement.style.setProperty('--vh', `${vh}px`);

let vw = document.documentElement.clientWidth * 0.01;
document.documentElement.style.setProperty('--vw', `${vw}px`);