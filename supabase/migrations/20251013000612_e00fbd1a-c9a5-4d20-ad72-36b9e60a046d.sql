-- Assign all lavoratori_selezionati to the admin user
UPDATE lavoratori_selezionati 
SET assigned_recruiter_id = '4ead345f-7f58-433c-b231-26bb4f7c57b0'
WHERE assigned_recruiter_id IS NULL OR assigned_recruiter_id != '4ead345f-7f58-433c-b231-26bb4f7c57b0';