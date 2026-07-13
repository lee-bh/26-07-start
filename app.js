import { SUPABASE_CONFIG } from './config.js';

// Application state
const state = {
  supabase: null,
  currentUser: null,
  mode: 'local', // 'local' or 'supabase'
  todos: [],
  selectedPriority: 'medium',
  activeFilter: 'all',
  currentEditingId: null
};

// DOM Elements
const connectionPill = document.getElementById('connectionPill');
const connectionStatusText = document.getElementById('connectionStatusText');
const btnSettings = document.getElementById('btnSettings');
const settingsModal = document.getElementById('settingsModal');
const btnSettingsClose = document.getElementById('btnSettingsClose');
const btnSettingsCancel = document.getElementById('btnSettingsCancel');
const btnSettingsSave = document.getElementById('btnSettingsSave');
const dbUrlInput = document.getElementById('dbUrl');
const dbAnonKeyInput = document.getElementById('dbAnonKey');

const authSection = document.getElementById('authSection');
const authTitle = document.getElementById('authTitle');
const tabSignin = document.getElementById('tabSignin');
const tabSignup = document.getElementById('tabSignup');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const userStatusSection = document.getElementById('userStatusSection');
const userEmailText = document.getElementById('userEmailText');
const btnSignOut = document.getElementById('btnSignOut');

const statTotal = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statProgressPercent = document.getElementById('statProgressPercent');
const progressBar = document.getElementById('progressBar');

const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const btnAddTodo = document.getElementById('btnAddTodo');
const priorityChips = document.querySelectorAll('.priority-chip');

const filterBtns = document.querySelectorAll('.filter-btn');
const btnClearCompleted = document.getElementById('btnClearCompleted');
const todoList = document.getElementById('todoList');
const toastContainer = document.getElementById('toastContainer');

// --- Helper: Toast Notification ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  else if (type === 'info') iconName = 'info';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  lucide.createIcons();
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Initialization ---
async function init() {
  setupEventListeners();
  await checkDatabaseConnection();
  await loadTodos();
  updateUI();
  lucide.createIcons();
}

// --- Connection & Client Configuration ---
async function checkDatabaseConnection() {
  const url = SUPABASE_CONFIG.supabaseUrl || localStorage.getItem('sb_url');
  const key = SUPABASE_CONFIG.supabaseAnonKey || localStorage.getItem('sb_key');

  // Fill in inputs in settings modal for convenience
  dbUrlInput.value = url || '';
  dbAnonKeyInput.value = key || '';

  if (url && key) {
    try {
      // Initialize Supabase Client
      state.supabase = supabase.createClient(url, key);
      
      // Test the connection by retrieving session
      const { data, error } = await state.supabase.auth.getSession();
      
      if (error) throw error;
      
      state.mode = 'supabase';
      state.currentUser = data.session ? data.session.user : null;
      
      // Listen to auth state changes
      state.supabase.auth.onAuthStateChange((event, session) => {
        state.currentUser = session ? session.user : null;
        handleAuthStateChange();
      });
      
      updateConnectionPill('connected', 'Supabase Cloud');
    } catch (err) {
      console.error('Supabase connection error:', err);
      state.mode = 'local';
      state.supabase = null;
      state.currentUser = null;
      updateConnectionPill('disconnected', 'Connection Error (Local Fallback)');
      showToast('Supabase 연결에 실패했습니다. 로컬 모드로 동작합니다.', 'error');
    }
  } else {
    state.mode = 'local';
    state.supabase = null;
    state.currentUser = null;
    updateConnectionPill('local', 'Local Storage');
  }

  handleAuthStateChange();
}

function updateConnectionPill(status, label) {
  connectionPill.className = `connection-badge ${status}`;
  connectionStatusText.textContent = label;
}

function handleAuthStateChange() {
  if (state.mode === 'supabase') {
    if (state.currentUser) {
      authSection.style.display = 'none';
      userStatusSection.style.display = 'flex';
      userEmailText.textContent = state.currentUser.email;
      todoForm.style.display = 'flex';
      document.querySelector('.todo-controls').style.display = 'flex';
      loadTodos().then(() => updateUI());
    } else {
      authSection.style.display = 'flex';
      userStatusSection.style.display = 'none';
      todoForm.style.display = 'none';
      document.querySelector('.todo-controls').style.display = 'none';
      state.todos = [];
      renderTodoList();
      updateStats();
    }
  } else {
    // Local mode
    authSection.style.display = 'none';
    userStatusSection.style.display = 'none';
    todoForm.style.display = 'flex';
    document.querySelector('.todo-controls').style.display = 'flex';
    loadTodos().then(() => updateUI());
  }
}

// --- Todo CRUD Operations ---
async function loadTodos() {
  // Show skeletons
  todoList.innerHTML = `
    <div class="skeleton-loader">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  `;

  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { data, error } = await state.supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      state.todos = data || [];
    } catch (err) {
      console.error('Failed to load todos from Supabase:', err);
      showToast('클라우드 데이터를 불러오지 못했습니다.', 'error');
      state.todos = [];
    }
  } else {
    // Load from Local Storage
    const localData = localStorage.getItem('cloud_todos_local');
    state.todos = localData ? JSON.parse(localData) : [];
  }
}

async function saveTodos() {
  if (state.mode === 'supabase' && state.currentUser) {
    // Database modifications are instant via CRUD, so local state is updated optimistically.
    // This is just a fallback wrapper.
  } else {
    // Save state to Local Storage
    localStorage.setItem('cloud_todos_local', JSON.stringify(state.todos));
  }
}

async function addTodo(title, priority) {
  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { data, error } = await state.supabase
        .from('todos')
        .insert([{ 
          title, 
          priority, 
          is_completed: false, 
          user_id: state.currentUser.id 
        }])
        .select()
        .single();

      if (error) throw error;
      state.todos.unshift(data);
      showToast('할 일이 추가되었습니다.');
    } catch (err) {
      console.error('Error adding todo:', err);
      showToast('할 일 추가에 실패했습니다.', 'error');
    }
  } else {
    // Local insertion
    const newTodo = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title,
      priority,
      is_completed: false,
      created_at: new Date().toISOString()
    };
    state.todos.unshift(newTodo);
    saveTodos();
    showToast('할 일이 로컬에 추가되었습니다.');
  }
  updateUI();
}

async function toggleTodo(id, isCompleted) {
  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { error } = await state.supabase
        .from('todos')
        .update({ is_completed: isCompleted })
        .eq('id', id);

      if (error) throw error;
      
      const todo = state.todos.find(t => t.id === id);
      if (todo) todo.is_completed = isCompleted;
    } catch (err) {
      console.error('Error toggling todo:', err);
      showToast('상태 업데이트에 실패했습니다.', 'error');
      // Revert in UI (handled by reloading)
      loadTodos().then(() => updateUI());
    }
  } else {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
      todo.is_completed = isCompleted;
      saveTodos();
    }
  }
  updateUI();
}

async function updateTodoTitle(id, newTitle) {
  if (!newTitle.trim()) return;
  
  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { error } = await state.supabase
        .from('todos')
        .update({ title: newTitle })
        .eq('id', id);

      if (error) throw error;
      
      const todo = state.todos.find(t => t.id === id);
      if (todo) todo.title = newTitle;
      showToast('수정되었습니다.');
    } catch (err) {
      console.error('Error updating todo title:', err);
      showToast('수정에 실패했습니다.', 'error');
    }
  } else {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
      todo.title = newTitle;
      saveTodos();
      showToast('수정되었습니다 (로컬).');
    }
  }
  state.currentEditingId = null;
  updateUI();
}

async function deleteTodo(id) {
  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { error } = await state.supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      state.todos = state.todos.filter(t => t.id !== id);
      showToast('삭제되었습니다.');
    } catch (err) {
      console.error('Error deleting todo:', err);
      showToast('삭제에 실패했습니다.', 'error');
    }
  } else {
    state.todos = state.todos.filter(t => t.id !== id);
    saveTodos();
    showToast('삭제되었습니다 (로컬).');
  }
  updateUI();
}

async function clearCompletedTodos() {
  const completedIds = state.todos.filter(t => t.is_completed).map(t => t.id);
  if (completedIds.length === 0) return;

  if (state.mode === 'supabase' && state.currentUser) {
    try {
      const { error } = await state.supabase
        .from('todos')
        .delete()
        .in('id', completedIds);

      if (error) throw error;
      state.todos = state.todos.filter(t => !t.is_completed);
      showToast('완료된 할 일을 모두 삭제했습니다.');
    } catch (err) {
      console.error('Error clearing completed todos:', err);
      showToast('삭제에 실패했습니다.', 'error');
    }
  } else {
    state.todos = state.todos.filter(t => !t.is_completed);
    saveTodos();
    showToast('완료된 할 일을 모두 삭제했습니다 (로컬).');
  }
  updateUI();
}

// --- Auth flows (Supabase Auth) ---
let isSignupMode = false;

function toggleAuthMode(signUp) {
  isSignupMode = signUp;
  if (signUp) {
    authTitle.textContent = '회원가입';
    tabSignup.classList.add('active');
    tabSignin.classList.remove('active');
    btnAuthSubmit.textContent = '가입하기';
  } else {
    authTitle.textContent = '로그인';
    tabSignup.classList.remove('active');
    tabSignin.classList.add('active');
    btnAuthSubmit.textContent = '로그인';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!state.supabase) return;

  btnAuthSubmit.disabled = true;
  btnAuthSubmit.textContent = isSignupMode ? '가입 중...' : '로그인 중...';

  try {
    if (isSignupMode) {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      
      // Supabase email verification check
      if (data.user && data.session === null) {
        showToast('인증 메일이 발송되었습니다. 메일함을 확인해주세요.', 'info');
      } else {
        showToast('회원가입 및 로그인이 완료되었습니다.');
        state.currentUser = data.user;
      }
    } else {
      const { data, error } = await state.supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      
      showToast('로그인에 성공했습니다.');
      state.currentUser = data.user;
    }
    
    // Clear forms
    authEmail.value = '';
    authPassword.value = '';
    handleAuthStateChange();
  } catch (err) {
    console.error('Auth error:', err);
    showToast(err.message || '인증 처리에 실패했습니다.', 'error');
  } finally {
    btnAuthSubmit.disabled = false;
    btnAuthSubmit.textContent = isSignupMode ? '가입하기' : '로그인';
  }
}

async function handleSignOut() {
  if (!state.supabase) return;

  try {
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;
    showToast('로그아웃 되었습니다.');
    state.currentUser = null;
    handleAuthStateChange();
  } catch (err) {
    console.error('Signout error:', err);
    showToast('로그아웃에 실패했습니다.', 'error');
  }
}

// --- UI Rendering & Stats ---
function updateUI() {
  renderTodoList();
  updateStats();
}

function updateStats() {
  const total = state.todos.length;
  const completed = state.todos.filter(t => t.is_completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  statTotal.textContent = total;
  statCompleted.textContent = completed;
  statProgressPercent.textContent = `${percentage}%`;
  progressBar.style.width = `${percentage}%`;
}

function renderTodoList() {
  todoList.innerHTML = '';

  // Filter list
  let filteredTodos = state.todos;
  if (state.activeFilter === 'active') {
    filteredTodos = state.todos.filter(t => !t.is_completed);
  } else if (state.activeFilter === 'completed') {
    filteredTodos = state.todos.filter(t => t.is_completed);
  }

  if (filteredTodos.length === 0) {
    renderEmptyState();
    return;
  }

  filteredTodos.forEach(todo => {
    const item = document.createElement('div');
    item.className = `todo-item ${todo.is_completed ? 'completed' : ''}`;
    item.dataset.id = todo.id;

    const isEditing = state.currentEditingId === todo.id;

    item.innerHTML = `
      <div class="todo-item-left">
        <label class="checkbox-container">
          <input type="checkbox" class="toggle-checkbox" ${todo.is_completed ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div class="todo-text-wrapper">
          ${isEditing 
            ? `<input type="text" class="todo-edit-input" value="${escapeHtml(todo.title)}">` 
            : `<span class="todo-title">${escapeHtml(todo.title)}</span>`
          }
        </div>
        <span class="priority-tag ${todo.priority}">${getPriorityLabel(todo.priority)}</span>
      </div>
      <div class="todo-item-actions">
        ${isEditing 
          ? `
            <button class="btn-item-action save-edit" title="저장"><i data-lucide="check"></i></button>
            <button class="btn-item-action cancel-edit" title="취소"><i data-lucide="x"></i></button>
          `
          : `
            <button class="btn-item-action edit-todo" title="수정"><i data-lucide="edit-3"></i></button>
            <button class="btn-item-action delete-todo delete" title="삭제"><i data-lucide="trash-2"></i></button>
          `
        }
      </div>
    `;

    // Event attachments for individual items
    const checkbox = item.querySelector('.toggle-checkbox');
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

    if (isEditing) {
      const editInput = item.querySelector('.todo-edit-input');
      editInput.focus();
      editInput.select();

      // Key events
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          updateTodoTitle(todo.id, editInput.value);
        } else if (e.key === 'Escape') {
          state.currentEditingId = null;
          updateUI();
        }
      });

      item.querySelector('.save-edit').addEventListener('click', () => {
        updateTodoTitle(todo.id, editInput.value);
      });

      item.querySelector('.cancel-edit').addEventListener('click', () => {
        state.currentEditingId = null;
        updateUI();
      });
    } else {
      item.querySelector('.edit-todo').addEventListener('click', () => {
        state.currentEditingId = todo.id;
        updateUI();
      });

      item.querySelector('.delete-todo').addEventListener('click', () => {
        deleteTodo(todo.id);
      });

      // Double click to edit
      item.querySelector('.todo-title').addEventListener('dblclick', () => {
        state.currentEditingId = todo.id;
        updateUI();
      });
    }

    todoList.appendChild(item);
  });

  lucide.createIcons();
}

function renderEmptyState() {
  todoList.innerHTML = `
    <div class="empty-state">
      <i data-lucide="clipboard-list" style="width: 48px; height: 48px;"></i>
      <h4>할 일 목록이 비어 있습니다</h4>
      <p>${state.activeFilter === 'all' ? '새로운 할 일을 추가하고 하루를 효율적으로 관리해보세요!' : '해당 필터에 만족하는 할 일이 없습니다.'}</p>
    </div>
  `;
  lucide.createIcons();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Connection badge settings modal click
  connectionPill.addEventListener('click', () => openSettingsModal());
  btnSettings.addEventListener('click', () => openSettingsModal());

  // Settings Modal closures
  btnSettingsClose.addEventListener('click', () => closeSettingsModal());
  btnSettingsCancel.addEventListener('click', () => closeSettingsModal());
  btnSettingsSave.addEventListener('click', () => saveSettings());

  // Close modal when clicking outside the card
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  // Auth actions
  tabSignin.addEventListener('click', () => toggleAuthMode(false));
  tabSignup.addEventListener('click', () => toggleAuthMode(true));
  authForm.addEventListener('submit', handleAuthSubmit);
  btnSignOut.addEventListener('click', handleSignOut);

  // Todo actions
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (title) {
      addTodo(title, state.selectedPriority);
      todoInput.value = '';
    }
  });

  // Priority chip selectors
  priorityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      priorityChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedPriority = chip.dataset.priority;
    });
  });

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderTodoList();
    });
  });

  btnClearCompleted.addEventListener('click', clearCompletedTodos);
}

// --- Modal Helper Functions ---
function openSettingsModal() {
  settingsModal.classList.add('active');
}

function closeSettingsModal() {
  settingsModal.classList.remove('active');
}

async function saveSettings() {
  const url = dbUrlInput.value.trim();
  const key = dbAnonKeyInput.value.trim();

  if (url === '' || key === '') {
    // Clear credentials -> Local mode
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    showToast('설정이 삭제되었습니다. 로컬 모드로 전환합니다.', 'info');
  } else {
    // Save to local storage for persistence
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    showToast('클라우드 설정이 저장되었습니다. 연결을 확인합니다.');
  }

  closeSettingsModal();
  await checkDatabaseConnection();
}

// --- Utility Functions ---
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 'low': return '낮음';
    case 'high': return '높음';
    default: return '보통';
  }
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', init);
// Run anyway if DOM already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  init();
}
