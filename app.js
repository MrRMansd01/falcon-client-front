document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing app...');
    
    // Define global variables early
    let selectedUserId = null;
    let selectedDateObject = new Date();
    let isAdmin = false;
    const ADMIN_ID = '23df94b7-412f-4321-a001-591c07fe622e';
    let supabase; // Define supabase here to make it accessible in the scope
    let selectedScore = 1; // Keep track of selected score
    let currentFilter = 'all'; // Keep track of the current filter
    let editingTaskId = null; // Keep track of the task being edited
    let userTaskMap = new Map(); // Add userTaskMap definition
    
    // --- 2. DOM Element References ---
    const taskModal = document.getElementById('taskModal');
    const addTaskBtn = document.querySelector('.add-task-btn');
    const submitTaskBtn = document.querySelector('.submit-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const timeStartInput = document.getElementById('time-start');
    const timeEndInput = document.getElementById('time-end');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const tasksContainer = document.querySelector('.tasks-container');
    const usersContainer = document.getElementById('users-container');
    const userNameElement = document.getElementById('username');
    const calendarBtn = document.querySelector('.calendar-btn');
    const userSearchInput = document.querySelector('.search-box .search-input'); // For user search
    const dayDisplayElement = document.querySelector('.date-display .day');
    const fullDateDisplayElement = document.querySelector('.date-display .full-date');
    
    // --- NEW: Excel Upload Elements ---
    const excelUploadBtn = document.getElementById('excelUploadBtn');
    const excelFileInput = document.getElementById('excelFileInput');
    
    const clearCompletedBtn = document.querySelector('.clear-completed-btn');
    const statsCompletedElement = document.querySelector('.stats .stat-card:nth-child(1) .stat-number');
    const statsPendingElement = document.querySelector('.stats .stat-card:nth-child(2) .stat-number');
    const statsTotalTimeElement = document.querySelector('.stats .stat-card:nth-child(3) .stat-number');
    const taskCountHeaderElement = document.querySelector('.task-count-number');
    const modalTitleElement = taskModal?.querySelector('h2');
    let flatpickrInstance = null;
    const editUserModal = document.getElementById('editUserModal');
    const editUserIdInput = document.getElementById('edit-user-id');
    const editUserNameInput = document.getElementById('edit-user-name');
    const editUserFilterInput = document.getElementById('edit-user-filter');
    const saveEditUserBtn = document.getElementById('saveEditUserBtn');
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
    
    // --- Function Definitions FIRST --- 
    // (Move all function definitions here: loadUsers, loadTasksForUser, etc.)

    async function loadTasksForUser(userId, userName, isAdminFlag, filter = 'all') {
        const tasksContainer = document.querySelector('.tasks-container');
        try {
            console.log(`[loadTasksForUser] Loading tasks for user: ${userName} (${userId}) with filter: ${filter}`);

            const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
            if (!currentUser || authError) {
                console.error('[loadTasksForUser] Authentication error or no user.');
                return;
            }
            if (!isAdminFlag && userId !== currentUser.id) {
                 console.error('[loadTasksForUser] Permission denied: Cannot view tasks of other users');
                 tasksContainer.innerHTML = '<div class="error-message" style="text-align: center; padding: 2rem; font-size: 1.2rem; color: #f44336;">دسترسی محدود است</div>';
                 updateStatsDisplay(0, 0, '0:00');
                 return;
            }
        
            console.log('[loadTasksForUser] Fetching tasks from Supabase...');
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId);

            if (filter === 'completed') {
                query = query.eq('is_completed', true);
            } else if (filter === 'incomplete') {
                query = query.eq('is_completed', false);
            }

            query = query.order('created_at', { ascending: false });
            
            const { data: tasks, error } = await query;
                
            if (error) {
                console.error('[loadTasksForUser] Error fetching tasks:', error);
                tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
                updateStatsDisplay(0, 0, '0:00');
                return;
            }
                
            console.log('[loadTasksForUser] Fetched tasks:', tasks);
                
            let allTasksForStats = [];
            try {
                const { data: statsTasks, error: statsError } = await supabase
                    .from('tasks')
                    .select('is_completed, time_start, time_end')
                    .eq('user_id', userId);
                if (statsError) throw statsError;
                allTasksForStats = statsTasks || [];
            } catch (error) {
                console.error('[loadTasksForUser] Error fetching tasks for stats:', error);
            }

            tasksContainer.innerHTML = '';
            
            let completedCount = 0;
            let pendingCount = 0;
            let totalMinutesStudied = 0;

            allTasksForStats.forEach(task => {
                if (task.is_completed) {
                    completedCount++;
                    if (task.time_start && task.time_end) {
                        try {
                            const start = new Date(`1970-01-01T${task.time_start}`);
                            const end = new Date(`1970-01-01T${task.time_end}`);
                            if (!isNaN(start) && !isNaN(end) && end > start) {
                                const durationMillis = end - start;
                                totalMinutesStudied += durationMillis / (1000 * 60);
                            }
                        } catch (e) {
                             console.warn('Could not parse time for stats:', task.time_start, task.time_end, e);
                        }
                    }
                } else {
                    pendingCount++;
                }
            });

            const hoursStudied = Math.floor(totalMinutesStudied / 60);
            const minutesStudied = Math.round(totalMinutesStudied % 60);
            const formattedTotalTime = `${hoursStudied}:${minutesStudied.toString().padStart(2, '0')}`;

            if (!tasks || tasks.length === 0) {
                console.log('[loadTasksForUser] No tasks found for this user/filter.');
                tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>';
            } else {
                console.log(`[loadTasksForUser] Found ${tasks.length} tasks. Rendering...`);
                tasks.forEach(task => {
                    const taskElement = createTaskElement(task, isAdminFlag);
                    tasksContainer.appendChild(taskElement);
                });
            }
             
            console.log('[loadTasksForUser] Task rendering complete.');

            updateStatsDisplay(completedCount, pendingCount, formattedTotalTime);

            const usersContainer = document.getElementById('users-container');
            const filterButtons = document.querySelectorAll('.filter-btn');
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedUserElement = usersContainer.querySelector(`.user-item[data-user-id="${userId}"]`);
            if (selectedUserElement) {
                selectedUserElement.classList.add('selected');
            }
                
        } catch (error) {
            console.error('[loadTasksForUser] Unexpected error:', error);
            tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
            updateStatsDisplay(0, 0, '0:00');
        }
    }
    
    function updateStatsDisplay(completed, pending, totalTime) {
        if (statsCompletedElement) statsCompletedElement.textContent = completed;
        if (statsPendingElement) statsPendingElement.textContent = pending;
        if (statsTotalTimeElement) statsTotalTimeElement.textContent = totalTime;
        if (taskCountHeaderElement) taskCountHeaderElement.textContent = completed + pending;
        console.log(`[updateStatsDisplay] Stats updated: Completed=${completed}, Pending=${pending}, TotalTime=${totalTime}`);
    }

    async function updateTaskStatus(taskId, isCompleted) {
        try {
            const { error } = await supabase.from('tasks').update({ 
                is_completed: isCompleted,
                updated_at: new Date().toISOString() 
            }).eq('id', taskId);
            if (error) throw error;
            
            const { data: { user } } = await supabase.auth.getUser();
            const targetUserId = selectedUserId || user?.id;
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            if(targetUserId) {
                await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
                await loadUsers(user, isAdmin);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('خطا در به‌روزرسانی وضعیت تسک');
        }
    }
    
    function createTaskElement(task, isAdminFlag) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item score${task.color || '1'}`;
        taskElement.dataset.id = task.id;
        const currentUserId = supabase.auth.getUser().data?.user?.id;
        const canModify = isAdminFlag || task.user_id === currentUserId;

        const formatTime = (timeStr) => {
            if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr.substring(0, 5))) return '';
            const [hours, minutes] = timeStr.split(':');
            return `${hours}:${minutes}`;
        };

        const startTime = formatTime(task.time_start);
        const endTime = formatTime(task.time_end);
        
        const taskDate = task.date ? new Date(task.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                
        taskElement.innerHTML = `
            <div class="task-checkbox">
                <input type="checkbox" class="task-complete-checkbox" 
                    ${task.is_completed ? 'checked' : ''} 
                    ${canModify ? '' : 'disabled'}> 
            </div>
            <div class="task-content">
                <span class="task-title">${task.title}</span>
                <div class="task-info">
                    ${taskDate ? `<span class="task-date"><i class="fas fa-calendar"></i> ${taskDate}</span>` : ''}
                    ${startTime ? `<span class="task-time"><i class="fas fa-clock"></i> ${startTime}</span>` : ''}
                    ${endTime ? `<span class="task-time"><i class="fas fa-stopwatch"></i> ${endTime}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                ${canModify ? `
                    <button class="task-btn edit-btn" title="ویرایش"><i class="fas fa-edit"></i></button>
                    <button class="task-btn delete-btn" title="حذف"><i class="fas fa-trash"></i></button>
                ` : ''} 
            </div>
        `;
            
        if (canModify) {
            const checkbox = taskElement.querySelector('.task-complete-checkbox');
            checkbox.addEventListener('change', async () => {
                await updateTaskStatus(task.id, checkbox.checked);
            });

            const deleteBtn = taskElement.querySelector('.delete-btn');
            deleteBtn?.addEventListener('click', async () => {
                if (confirm('آیا مطمئن هستید که می‌خواهید این تسک را حذف کنید؟')) {
                    await deleteTask(task.id);
                }
            });

            const editBtn = taskElement.querySelector('.edit-btn');
            editBtn?.addEventListener('click', () => { 
                showTaskModal(task);
            });
        }
            
        return taskElement;
    }
        
    async function loadUsers(currentUser, isAdminFlag) {
        const usersContainer = document.getElementById('users-container');
        if (!usersContainer) {
            console.error("Error: Could not find element with ID 'users-container'");
            return;
        }
        try {
            console.log('Loading users...');
            
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (usersError) {
                console.error('Error fetching users:', usersError);
                usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
                return;
            }
                
            if (!users || users.length === 0) {
                usersContainer.innerHTML = '<li class="no-users">هیچ کاربری یافت نشد</li>';
                return;
            }
                
            const { data: allTasks, error: tasksError } = await supabase
                .from('tasks')
                .select('user_id, is_completed');
            
            if (tasksError) {
                 console.error('Error fetching tasks for count:', tasksError);
            }
            
            userTaskMap.clear();
            
            const taskCounts = {};
            const completedCounts = {};
            if (allTasks) {
                allTasks.forEach(task => {
                    if (task.user_id) {
                        taskCounts[task.user_id] = (taskCounts[task.user_id] || 0) + 1;
                        if (task.is_completed) {
                            completedCounts[task.user_id] = (completedCounts[task.user_id] || 0) + 1;
                        }
                    }
                });
            }
            
            users.forEach(user => {
                const totalTasks = taskCounts[user.id] || 0;
                const completedTasks = completedCounts[user.id] || 0;
                userTaskMap.set(user.id, {
                    ...user,
                    taskCount: totalTasks,
                    completedCount: completedTasks,
                    incompleteCount: totalTasks - completedTasks
                });
            });
            
            if (typeof isAdminFlag === 'undefined' || typeof currentUser === 'undefined') {
                 console.error('Error in loadUsers: isAdmin or user is not defined!');
                 return;
            }
            
            const usersToDisplay = isAdminFlag ? users : users.filter(u => u.id === currentUser.id);
            
            usersContainer.innerHTML = '';
            usersToDisplay.forEach(userProfile => {
                const userElement = document.createElement('li');
                userElement.className = 'user-item';
                userElement.dataset.userId = userProfile.id;

                if (userProfile.id === selectedUserId) { 
                    userElement.classList.add('selected');
                }
                if (userProfile.id === ADMIN_ID) {
                    userElement.classList.add('admin-user');
                }
                
                if (userProfile.id === currentUser?.id) { 
                    userElement.classList.add('current-user');
                }

                const userData = userTaskMap.get(userProfile.id);
                const taskCount = userData ? userData.taskCount : 0;

                userElement.innerHTML = `
                    <div class="user-actions">
                        <button class="user-action-btn dots-btn" title="گزینه‌ها"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="user-actions-menu">
                            <button class="menu-item edit-user-btn">ویرایش</button>
                            <button class="menu-item delete-user-btn">حذف</button>
                        </div>
                    </div>
                    <span class="user-name">${userProfile.name || userProfile.username || userProfile.email}</span>
                    <span class="task-count">${taskCount} تسک</span>
                `;
                
                userElement.addEventListener('click', (event) => {
                    if (event.target.closest('.user-actions')) return;
                    if (selectedUserId === userProfile.id) return;

                    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
                    userElement.classList.add('selected');
                    selectedUserId = userProfile.id;
                    loadTasksForUser(userProfile.id, userProfile.username || userProfile.email, isAdminFlag, userProfile.filter || currentFilter);
                });

                const dotsBtn = userElement.querySelector('.dots-btn');
                const actionsMenu = userElement.querySelector('.user-actions-menu');
                
                dotsBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    document.querySelectorAll('.user-actions-menu.visible').forEach(menu => {
                        if (menu !== actionsMenu) menu.classList.remove('visible');
                    });
                    actionsMenu.classList.toggle('visible');
                });
                
                const editBtn = userElement.querySelector('.edit-user-btn');
                editBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openEditUserModal(userProfile.id);
                });

                const deleteBtn = userElement.querySelector('.delete-user-btn');
                deleteBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await deleteUserProfile(userProfile.id, userProfile.name || userProfile.username || userProfile.email);
                });
                
                usersContainer.appendChild(userElement);
            });

            document.addEventListener('click', (event) => {
                if (!event.target.closest('.user-actions')) {
                    document.querySelectorAll('.user-actions-menu.visible').forEach(menu => menu.classList.remove('visible'));
                }
            }, true);

            if (!selectedUserId && currentUser) {
                const currentUserElement = usersContainer.querySelector(`.user-item[data-user-id="${currentUser.id}"]`);
                if (currentUserElement) currentUserElement.click();
            }
            
        } catch (error) {
            console.error('Error details in loadUsers:', error);
            usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
        }
    }
    
    function showTaskModal(taskToEdit = null) {
        editingTaskId = taskToEdit ? taskToEdit.id : null;
        
        if (editingTaskId) {
            console.log('[showTaskModal] Opening in EDIT mode for task:', taskToEdit);
            if (modalTitleElement) modalTitleElement.textContent = 'ویرایش تسک';
            if (taskTitleInput) taskTitleInput.value = taskToEdit.title;
            if (timeStartInput) timeStartInput.value = taskToEdit.time_start || '';
            if (timeEndInput) timeEndInput.value = taskToEdit.time_end || '';
            
            selectedDateObject = taskToEdit.date ? new Date(taskToEdit.date) : new Date();
            if (flatpickrInstance) {
                 flatpickrInstance.setDate(selectedDateObject, true);
                 taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            } else if (taskDateInput) {
                taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR');
            }

            selectedScore = parseInt(taskToEdit.color || '1');
            categoryButtons.forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.score) === selectedScore) btn.classList.add('active');
            });

            if (submitTaskBtn) submitTaskBtn.textContent = 'ذخیره تغییرات';

        } else {
            console.log('[showTaskModal] Opening in ADD mode');
            resetTaskForm(); 
        }
        
        taskModal.style.display = 'block';
    }
    
    function hideTaskModal() {
        taskModal.style.display = 'none';
        editingTaskId = null;
        resetTaskForm(); 
    }
    
    function resetTaskForm() {
        console.log('[resetTaskForm] Resetting form to ADD mode...');
        editingTaskId = null;
        
        if (modalTitleElement) modalTitleElement.textContent = 'تسک جدید';
        if (submitTaskBtn) submitTaskBtn.textContent = 'افزودن تسک';
        
        if (taskTitleInput) taskTitleInput.value = '';
        if (timeStartInput) timeStartInput.value = '';
        if (timeEndInput) timeEndInput.value = '';
        
        selectedDateObject = new Date(); 
        if (flatpickrInstance) {
            flatpickrInstance.setDate(selectedDateObject, true); 
             taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        } else if (taskDateInput) {
             taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR');
        }

        categoryButtons?.forEach(btn => btn.classList.remove('active'));
        const firstCategory = categoryButtons?.[0];
        if (firstCategory) {
             firstCategory.classList.add('active');
             selectedScore = parseInt(firstCategory.dataset.score) || 1;
        } else {
            selectedScore = 1;
        }
    }
    
    async function deleteTask(taskId) {
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            
            const { data: { user } } = await supabase.auth.getUser();
            const targetUserId = selectedUserId || user?.id;
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            if (targetUserId) {
                await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
                await loadUsers(user, isAdmin);
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('خطا در حذف تسک');
        }
    }
    
    function formatDateToYYYYMMDD(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.error('تاریخ نامعتبر است:', date);
            return null;
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    async function clearCompletedTasks() {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = selectedUserId || user?.id;

        if (!targetUserId) {
            console.error('Cannot clear completed tasks: No user selected.');
            return;
        }

        if (!confirm('آیا مطمئن هستید که می‌خواهید تمام تسک‌های تکمیل شده این کاربر را حذف کنید؟')) {
            return;
        }

        console.log(`[clearCompletedTasks] Clearing completed tasks for user ${targetUserId}`);
        try {
            const { error } = await supabase.from('tasks').delete().eq('user_id', targetUserId).eq('is_completed', true);
            if (error) throw error;
            
            console.log('[clearCompletedTasks] Completed tasks deleted successfully.');
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
            await loadUsers(user, isAdmin);

        } catch (error) {
            console.error('Error clearing completed tasks:', error);
            alert('خطا در حذف تسک‌های تکمیل شده.');
        }
    }

    function searchUsers(searchTerm) {
        const userElements = usersContainer?.querySelectorAll('.user-item');
        if (!userElements) return;
        
        console.log('Searching users for term:', searchTerm);
        
        if (!searchTerm) {
            userElements.forEach(userEl => userEl.style.display = '');
            return;
        }
        
        userElements.forEach(userEl => {
            const userName = userEl.querySelector('.user-name')?.textContent.toLowerCase();
            if (userName && userName.includes(searchTerm)) {
                userEl.style.display = '';
            } else {
                userEl.style.display = 'none';
            }
        });
    }

    async function saveUserEdit() {
        const userId = document.getElementById('edit-user-id').value;
        const newName = document.getElementById('edit-user-name').value;
        const newFilter = document.getElementById('edit-user-filter').value;

        if (!userId || !newName) {
            alert('لطفا تمام فیلدهای ضروری را پر کنید');
            return;
        }
            
        try {
            const updates = { name: newName.trim(), filter: newFilter, updated_at: new Date().toISOString() };
            const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
            if (error) throw error;
            
            const { data: verifyData } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (verifyData) {
                const currentUserData = userTaskMap.get(userId);
                if (currentUserData) {
                    userTaskMap.set(userId, { ...currentUserData, name: verifyData.name, filter: verifyData.filter });
                }
            }

            hideEditUserModal();
            alert('اطلاعات کاربر با موفقیت بروزرسانی شد');
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            await loadUsers(currentUser, isAdmin);
            if (selectedUserId === userId) {
                await loadTasksForUser(userId, verifyData?.name || updates.name, isAdmin, verifyData?.filter || updates.filter);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('خطا در بروزرسانی اطلاعات کاربر');
        }
    }

    function openEditUserModal(userId) {
        supabase.from('profiles').select('*').eq('id', userId).single().then(({ data: freshData, error }) => {
            if (error) {
                console.error('Error fetching fresh user data:', error);
                return;
            }
            
            if (editUserIdInput) editUserIdInput.value = userId;
            if (editUserNameInput) editUserNameInput.value = freshData?.name || '';
            if (editUserFilterInput) {
                editUserFilterInput.value = freshData?.filter || '';
                editUserFilterInput.style.direction = 'ltr';
            }
            if (editUserModal) editUserModal.style.display = 'block';

            const newSaveBtn = saveEditUserBtn.cloneNode(true);
            saveEditUserBtn.parentNode.replaceChild(newSaveBtn, saveEditUserBtn);
            newSaveBtn.addEventListener('click', async () => await saveUserEdit());

            const newCancelBtn = cancelEditUserBtn.cloneNode(true);
            cancelEditUserBtn.parentNode.replaceChild(newCancelBtn, cancelEditUserBtn);
            newCancelBtn.addEventListener('click', () => hideEditUserModal());

            editUserModal.onclick = (event) => {
                if (event.target === editUserModal) hideEditUserModal();
            };
        });
    }

    function hideEditUserModal() {
        if (editUserModal) editUserModal.style.display = 'none';
        if (editUserIdInput) editUserIdInput.value = '';
        if (editUserNameInput) editUserNameInput.value = '';
        if (editUserFilterInput) editUserFilterInput.value = '';
    }

    async function deleteUserProfile(userIdToDelete, userName) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (userIdToDelete === currentUser?.id) {
            alert('شما نمی‌توانید حساب کاربری خودتان را از اینجا حذف کنید.');
            return;
        }
        if (userIdToDelete === ADMIN_ID) {
            alert('امکان حذف کاربر ادمین وجود ندارد.');
            return;
        }
                
        if (!confirm(`آیا مطمئن هستید که می‌خواهید کاربر "${userName}" و تمام تسک‌هایش را حذف کنید؟ این عمل غیرقابل بازگشت است.`)) {
            return;
        }

        try {
            const { error: taskError } = await supabase.from('tasks').delete().eq('user_id', userIdToDelete);
            if (taskError) {
                 alert('خطا در حذف تسک‌های کاربر. پروفایل حذف نشد.');
                 return;
            }
            
            const { error: profileError } = await supabase.from('profiles').delete().eq('id', userIdToDelete);
            if (profileError) throw profileError;
            
            if (selectedUserId === userIdToDelete) selectedUserId = currentUser.id;
            await loadUsers(currentUser, isAdmin);

        } catch (error) {
            console.error('Error deleting user profile or tasks:', error);
            alert('خطا در حذف کاربر یا تسک‌هایش.');
        }
    }

    async function createTask(taskData) {
        try {
            const { data, error } = await supabase.from('tasks').insert([taskData]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating task:', error);
            alert('خطا در ایجاد تسک');
            throw error;
        }
    }

    // --- End of Function Definitions ---

    try {
        if (!window.supabase) {
            alert('خطا در بارگذاری کتابخانه Supabase. لطفا صفحه را دوباره بارگذاری کنید.');
            return;
        }
        
        const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        let user, authError;
        try {
            const { data, error } = await supabase.auth.getUser();
            user = data?.user;
            authError = error;
        } catch (e) {
            authError = e;
        }
        
        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }
        
        console.log('User authenticated:', user.email);
        
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            
        if (profileError || !profile) {
            const { error: createError } = await supabase.from('profiles').insert([{ id: user.id, username: user.email.split('@')[0], email: user.email, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
            if (createError) {
                alert('خطا در ایجاد پروفایل کاربر');
                return;
            }
        }
        
        userNameElement.textContent = profile?.name || user.email;
        isAdmin = user.id === ADMIN_ID;
        await loadUsers(user, isAdmin);
        
        const flatpickrWrapper = document.querySelector('.flatpickr-wrapper'); 
        if (flatpickrWrapper) { 
            flatpickrInstance = flatpickr(flatpickrWrapper, {
                locale: "fa",
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "l ، j F Y",
                wrap: true,
                defaultDate: selectedDateObject,
                onChange: (selectedDates) => {
                    if (selectedDates.length > 0) selectedDateObject = selectedDates[0];
                },
            });
        }

        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedScore = parseInt(btn.getAttribute('data-score'));
            });
        });

        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', async () => {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                const { data: { user } } = await supabase.auth.getUser();
                const targetUserId = selectedUserId || user.id;
                const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user.email;
                await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
            });
        });

        addTaskBtn?.addEventListener('click', () => showTaskModal());

        userSearchInput?.addEventListener('input', (event) => searchUsers(event.target.value.toLowerCase()));
        
        // --- NEW: EXCEL UPLOAD EVENT LISTENERS ---
        excelUploadBtn?.addEventListener('click', () => {
            excelFileInput.click();
        });

        excelFileInput?.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const targetUserId = selectedUserId || user.id;
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user.email;

            if (!confirm(`آیا می‌خواهید تسک‌ها را از فایل "${file.name}" برای کاربر "${targetUserName}" آپلود کنید؟\n\nستون‌های مورد انتظار: title, date, time_start, time_end, color`)) {
                excelFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(worksheet);

                    if (!rows || rows.length === 0) {
                        alert('فایل اکسل خالی است یا فرمت آن صحیح نیست.');
                        return;
                    }

                    const tasksToInsert = [];
                    let invalidRows = 0;

                    for (const row of rows) {
                        const title = row.title ? String(row.title).trim() : null;
                        if (!title) {
                            invalidRows++;
                            continue;
                        }

                        let formattedDate = null;
                        if (row.date && row.date instanceof Date && !isNaN(row.date)) {
                            formattedDate = formatDateToYYYYMMDD(row.date);
                        } else {
                            formattedDate = formatDateToYYYYMMDD(new Date()); // Default to today
                        }

                        tasksToInsert.push({
                            title: title,
                            date: formattedDate,
                            time_start: row.time_start || null,
                            time_end: row.time_end || null,
                            color: row.color ? parseInt(row.color) : 1,
                            is_completed: false,
                            user_id: targetUserId,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    }

                    if (tasksToInsert.length === 0) {
                        alert(`هیچ تسک معتبری (با عنوان) در فایل یافت نشد. ردیف‌های نامعتبر: ${invalidRows}`);
                        return;
                    }

                    const { error } = await supabase.from('tasks').insert(tasksToInsert);
                    if (error) throw error;

                    alert(`${tasksToInsert.length} تسک با موفقیت آپلود شد.` + (invalidRows > 0 ? `\n${invalidRows} ردیف نامعتبر نادیده گرفته شد.` : ''));
                    
                    await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
                    await loadUsers(user, isAdmin);

                } catch (error) {
                    console.error('Failed to process Excel file:', error);
                    alert('خطا در پردازش فایل اکسل. لطفا از فرمت صحیح فایل اطمینان حاصل کنید.');
                } finally {
                    excelFileInput.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        });
        // --- END NEW LISTENERS ---

        submitTaskBtn?.addEventListener('click', async () => {
            const taskTitle = taskTitleInput?.value.trim();
            if (!taskTitle) {
                alert('لطفا عنوان تسک را وارد کنید');
                return;
            }
            
            if (!(selectedDateObject instanceof Date) || isNaN(selectedDateObject.getTime())) {
                alert('لطفا تاریخ معتبر انتخاب کنید');
                return;
            }

            const formattedDate = formatDateToYYYYMMDD(selectedDateObject);
            if (!formattedDate) return;

            const targetUserId = selectedUserId || user.id;
            if (!targetUserId) return;

            try {
                if (editingTaskId) {
                    const { error } = await supabase.from('tasks').update({
                        title: taskTitle,
                        date: formattedDate,
                        time_start: timeStartInput?.value || null,
                        time_end: timeEndInput?.value || null,
                        color: selectedScore,
                        updated_at: new Date().toISOString()
                    }).eq('id', editingTaskId);
                    if (error) throw error;
                    hideTaskModal();
                    const { data: { user } } = await supabase.auth.getUser();
                    const targetUserName = document.querySelector(`.user-item[data-user-id="${selectedUserId}"] .user-name`)?.textContent || user?.email;
                    if(selectedUserId) await loadTasksForUser(selectedUserId, targetUserName, isAdmin, currentFilter);
                } else {
                    await createTask({
                        title: taskTitle,
                        date: formattedDate,
                        time_start: timeStartInput?.value || null,
                        time_end: timeEndInput?.value || null,
                        color: selectedScore,
                        user_id: targetUserId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                    hideTaskModal();
                    await loadTasksForUser(selectedUserId, userNameElement.textContent, isAdmin, currentFilter);
                }
            } catch (error) {
                console.error('خطا در ثبت تسک:', error);
                alert('خطا در ثبت تسک');
            }
        });

    } catch (error) {
        console.error('Error initializing app:', error);
        alert('خطا در بارگذاری برنامه');
    }
});