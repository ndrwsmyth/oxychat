CREATE INDEX IF NOT EXISTS idx_conversations_project_not_deleted
  ON conversations(project_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION workspace_tree_rows(target_user_id UUID)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_scope workspace_scope,
  project_id UUID,
  project_name TEXT,
  project_scope workspace_scope,
  project_client_id UUID,
  conversation_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = target_user_id
        AND ur.role = 'admin'
    ) AS is_admin
  ),
  member_clients AS (
    SELECT cm.client_id
    FROM client_memberships cm
    WHERE cm.user_id = target_user_id
  ),
  member_projects AS (
    SELECT pm.project_id
    FROM project_memberships pm
    WHERE pm.user_id = target_user_id
  ),
  visible_projects AS (
    SELECT p.id, p.client_id, p.name, p.scope
    FROM projects p
    CROSS JOIN viewer v
    WHERE v.is_admin
      OR p.owner_user_id = target_user_id
      OR p.id IN (SELECT mp.project_id FROM member_projects mp)
      OR p.client_id IN (SELECT mc.client_id FROM member_clients mc)
  ),
  visible_clients AS (
    SELECT c.id, c.name, c.scope
    FROM clients c
    CROSS JOIN viewer v
    WHERE v.is_admin
      OR c.id IN (SELECT vp.client_id FROM visible_projects vp)
      OR c.owner_user_id = target_user_id
      OR c.id IN (SELECT mc.client_id FROM member_clients mc)
  ),
  conversation_counts AS (
    SELECT cv.project_id, COUNT(*)::BIGINT AS conversation_count
    FROM conversations cv
    INNER JOIN visible_projects vp ON vp.id = cv.project_id
    WHERE cv.deleted_at IS NULL
    GROUP BY cv.project_id
  )
  SELECT
    vc.id AS client_id,
    vc.name AS client_name,
    vc.scope AS client_scope,
    vp.id AS project_id,
    vp.name AS project_name,
    vp.scope AS project_scope,
    vp.client_id AS project_client_id,
    COALESCE(cc.conversation_count, 0)::BIGINT AS conversation_count
  FROM visible_clients vc
  LEFT JOIN visible_projects vp ON vp.client_id = vc.id
  LEFT JOIN conversation_counts cc ON cc.project_id = vp.id
  ORDER BY vc.name ASC, vp.name ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION workspace_tree_rows(UUID) TO anon, authenticated, service_role;
