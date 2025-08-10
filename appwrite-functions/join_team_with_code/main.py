from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.services.teams import Teams
from appwrite.exception import AppwriteException
from appwrite.query import Query
import json
import os


def _json_response(context, status_code: int, payload: dict):
    return context.res.json(payload, status_code)


def main(context):
    api_key = (
        context.req.headers.get("x-appwrite-key")
        or os.environ.get("APPWRITE_API_KEY")
        or os.environ.get("APPWRITE_FUNCTION_API_KEY")
    )

    client = Client()
    client.set_endpoint(os.environ.get("APPWRITE_FUNCTION_API_ENDPOINT"))
    client.set_project(os.environ.get("APPWRITE_FUNCTION_PROJECT_ID"))
    if api_key:
        client.set_key(api_key)

    users = Users(client)
    teams = Teams(client)

    # Health check route
    if context.req.path == "/ping":
        return context.res.text("Pong")

    # Parse request body
    try:
        body_raw = context.req.body or "{}"
        payload = json.loads(body_raw)
    except Exception:
        return _json_response(context, 400, {"success": False, "error": "Invalid JSON body"})

    join_code = (payload.get("joinCode") or "").strip()
    if not join_code:
        return _json_response(context, 400, {"success": False, "error": "joinCode is required"})

    # Identify the caller user
    user_id = context.req.headers.get("x-appwrite-user-id")
    if not user_id:
        # Try to infer using Users service if possible (should not be necessary when invoked with a session)
        try:
            # Will fail without a specific user; keep consistent error message
            users.list()  # no-op to validate connectivity
        except AppwriteException:
            pass
        return _json_response(context, 401, {"success": False, "error": "Unauthorized: missing user"})

    # Find team by prefs.joinCode. We page through teams since querying by prefs is not supported directly.
    try:
        page_size = 100
        offset = 0
        found_team = None

        while True:
            res = teams.list(queries=[Query.limit(page_size), Query.offset(offset)])
            team_list = res.get("teams", []) if isinstance(res, dict) else []
            total = res.get("total", 0) if isinstance(res, dict) else 0

            for t in team_list:
                prefs = t.get("prefs", {}) if isinstance(t, dict) else {}
                code = (prefs.get("joinCode") or "").strip()
                if code and code == join_code:
                    found_team = t
                    break

            if found_team or offset + page_size >= total:
                break
            offset += page_size

        if not found_team:
            return _json_response(context, 404, {"success": False, "error": "Invalid join code"})

        team_id = found_team.get("$id")
        team_name = found_team.get("name")
        if not team_id:
            return _json_response(context, 500, {"success": False, "error": "Malformed team data"})

        # If user is already a member, return success idempotently
        try:
            existing = teams.list_memberships(team_id=team_id, queries=[Query.equal('userId', user_id), Query.limit(1)])
            memberships = existing.get('memberships') if isinstance(existing, dict) else None
            if (isinstance(memberships, list) and memberships) or (isinstance(existing, dict) and existing.get('total', 0) > 0):
                return _json_response(
                    context,
                    200,
                    {"success": True, "teamId": team_id, "teamName": team_name, "alreadyMember": True},
                )
        except AppwriteException:
            # If listing fails, continue to attempt add
            pass

        # Add the user as a member immediately using server key
        membership = teams.create_membership(
            team_id=team_id,
            roles=["member"],
            user_id=user_id,
        )

        return _json_response(
            context,
            200,
            {
                "success": True,
                "teamId": team_id,
                "teamName": team_name,
                "membershipId": (membership.get("$id") if isinstance(membership, dict) else None),
            },
        )

    except AppwriteException as err:
        context.error("Join by code failed: " + repr(err))
        message = getattr(err, "message", None) or str(err)
        code = getattr(err, "code", 500) or 500
        # Treat duplicate/already-member as success (idempotent)
        if isinstance(code, int) and code == 409:
            if isinstance(message, str) and 'already' in message.lower():
                return _json_response(context, 200, {"success": True, "note": "Already a member"})
        status = int(code) if isinstance(code, int) else 500
        return _json_response(context, status, {"success": False, "error": message})
    except Exception as err:  # pragma: no cover
        context.error("Unhandled error: " + repr(err))
        return _json_response(context, 500, {"success": False, "error": "Internal error"})

